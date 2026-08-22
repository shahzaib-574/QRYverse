import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { QryDatabase, type AuthIdentity, type CampaignRow } from './database.js';
import { cleanText, InputError, normalizeEmail, slugify, validateDestination, validatePassword } from './security.js';

export type ServerOptions = { databasePath: string; publicBaseUrl: string; corsOrigins?: string[] };
type JsonObject = Record<string, unknown>;

class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

class RateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();
  check(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) { this.buckets.set(key, { count: 1, resetAt: now + windowMs }); return true; }
    bucket.count += 1;
    return bucket.count <= limit;
  }
}

export function createQryServer(options: ServerOptions) {
  if (options.databasePath !== ':memory:') mkdirSync(dirname(options.databasePath), { recursive: true });
  const database = new QryDatabase(options.databasePath);
  const publicBaseUrl = options.publicBaseUrl.replace(/\/+$/, '');
  const corsOrigins = new Set(options.corsOrigins ?? ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://localhost', 'capacitor://localhost']);
  const limiter = new RateLimiter();

  const server = createServer(async (request, response) => {
    setSecurityHeaders(response);
    try {
      const url = new URL(request.url ?? '/', publicBaseUrl);
      const origin = request.headers.origin;
      const isApi = url.pathname.startsWith('/v1/');
      if (isApi && origin) {
        if (!corsOrigins.has(origin)) throw new HttpError(403, 'origin_not_allowed', 'This browser origin is not allowed.');
        response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Vary', 'Origin');
        response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      }
      if (request.method === 'OPTIONS') { response.writeHead(204).end(); return; }

      if (request.method === 'GET' && url.pathname === '/v1/health') {
        json(response, 200, { ok: true, service: 'QRYverse Cloud', publicBaseUrl, privacy: { storesIpAddresses: false, scanAggregation: 'daily' } }); return;
      }
      if (request.method === 'POST' && url.pathname === '/v1/auth/register') {
        enforceRateLimit(request, limiter, 'register', 10, 15 * 60_000);
        const body = await readJson(request, 64 * 1024);
        try {
          const result = database.register({ email: normalizeEmail(body.email), password: validatePassword(body.password), name: cleanText(body.name, 'Name', 100), organizationName: cleanText(body.organizationName, 'Organization name', 120) });
          json(response, 201, authResponse(result.token, result.identity, publicBaseUrl));
        } catch (error) {
          if (String(error).includes('UNIQUE constraint failed: users.email')) throw new HttpError(409, 'email_exists', 'An account already exists for this email.');
          throw error;
        }
        return;
      }
      if (request.method === 'POST' && url.pathname === '/v1/auth/login') {
        enforceRateLimit(request, limiter, 'login', 20, 15 * 60_000);
        const body = await readJson(request, 32 * 1024);
        const result = database.login(normalizeEmail(body.email), validatePassword(body.password));
        if (!result) throw new HttpError(401, 'invalid_credentials', 'Email or password is incorrect.');
        json(response, 200, authResponse(result.token, result.identity, publicBaseUrl)); return;
      }

      const redirectMatch = request.method === 'GET' && url.pathname.match(/^\/r\/([a-z0-9-]{3,64})$/);
      if (redirectMatch) {
        enforceRateLimit(request, limiter, 'redirect', 300, 60_000);
        const campaign = database.getCampaignBySlug(redirectMatch[1]);
        if (!campaign) { html(response, 404, 'QRY link not found', 'This dynamic QR campaign does not exist.'); return; }
        if (!campaign.active) { html(response, 410, 'QRY link paused', 'This dynamic QR campaign is currently paused.'); return; }
        database.recordCampaignScan(campaign.id);
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('Referrer-Policy', 'no-referrer');
        response.writeHead(302, { Location: campaign.destination }).end(); return;
      }

      const identity = requireIdentity(request, database);
      const token = bearerToken(request)!;
      if (request.method === 'POST' && url.pathname === '/v1/auth/logout') { database.logout(token); response.writeHead(204).end(); return; }
      if (request.method === 'GET' && url.pathname === '/v1/me') { json(response, 200, authResponse(undefined, identity, publicBaseUrl)); return; }
      if (request.method === 'DELETE' && url.pathname === '/v1/account') {
        requireOwnerRole(identity);
        if (!database.deleteOrganizationAccount(identity)) throw new HttpError(404, 'account_not_found', 'The organization account was not found.');
        response.writeHead(204).end(); return;
      }

      if (request.method === 'GET' && url.pathname === '/v1/sync') {
        const document = database.getSync(identity.organizationId);
        json(response, 200, document ?? { version: 0, payload: null, updatedAt: 0 }); return;
      }
      if (request.method === 'PUT' && url.pathname === '/v1/sync') {
        requireWriteRole(identity);
        const body = await readJson(request, 8 * 1024 * 1024);
        if (!Number.isInteger(body.baseVersion) || Number(body.baseVersion) < 0) throw new HttpError(400, 'invalid_version', 'baseVersion must be a non-negative integer.');
        validateSyncPayload(body.payload);
        const result = database.putSync(identity, Number(body.baseVersion), body.payload);
        if ('conflict' in result) { json(response, 409, { error: 'sync_conflict', message: 'Cloud data changed on another device.', current: result.current }); return; }
        json(response, 200, result); return;
      }

      if (request.method === 'GET' && url.pathname === '/v1/campaigns') {
        json(response, 200, { campaigns: database.listCampaigns(identity.organizationId).map((row) => campaignDto(row, publicBaseUrl)) }); return;
      }
      const campaignMatch = url.pathname.match(/^\/v1\/campaigns\/([^/]+)(?:\/analytics)?$/);
      if (campaignMatch && request.method === 'GET' && url.pathname.endsWith('/analytics')) {
        const analytics = database.campaignAnalytics(decodeURIComponent(campaignMatch[1]), identity.organizationId);
        if (!analytics) throw new HttpError(404, 'campaign_not_found', 'Campaign was not found.');
        json(response, 200, analytics); return;
      }
      if (campaignMatch && request.method === 'PUT' && !url.pathname.endsWith('/analytics')) {
        requireCampaignRole(identity);
        const body = await readJson(request, 64 * 1024);
        const id = decodeURIComponent(campaignMatch[1]);
        if (!/^[A-Za-z0-9_-]{3,100}$/.test(id)) throw new HttpError(400, 'invalid_campaign_id', 'Campaign id is invalid.');
        try {
          const campaign = database.upsertCampaign(identity, { id, name: cleanText(body.name, 'Campaign name', 120), slug: slugify(body.slug), destination: validateDestination(body.destination), color: validColor(body.color), active: body.active !== false });
          json(response, 200, campaignDto(campaign, publicBaseUrl));
        } catch (error) {
          if (String(error).includes('UNIQUE constraint failed: campaigns.slug')) throw new HttpError(409, 'slug_exists', 'That public slug is already in use.');
          throw error;
        }
        return;
      }
      if (campaignMatch && request.method === 'DELETE' && !url.pathname.endsWith('/analytics')) {
        requireCampaignRole(identity);
        if (!database.deleteCampaign(decodeURIComponent(campaignMatch[1]), identity.organizationId)) throw new HttpError(404, 'campaign_not_found', 'Campaign was not found.');
        response.writeHead(204).end(); return;
      }

      throw new HttpError(404, 'not_found', 'Route was not found.');
    } catch (error) {
      const status = error instanceof HttpError ? error.status : error instanceof InputError || error instanceof SyntaxError ? 400 : 500;
      const code = error instanceof HttpError ? error.code : error instanceof InputError ? 'invalid_input' : status === 400 ? 'invalid_json' : 'server_error';
      const message = status === 500 ? 'The service could not complete this request.' : error instanceof Error ? error.message : 'Request failed.';
      if (!response.headersSent) json(response, status, { error: code, message }); else response.end();
    }
  });

  server.on('close', () => database.close());
  return { server, database };
}

function requireIdentity(request: IncomingMessage, database: QryDatabase): AuthIdentity {
  const token = bearerToken(request);
  const identity = token ? database.authenticate(token) : undefined;
  if (!identity) throw new HttpError(401, 'unauthorized', 'A valid account session is required.');
  return identity;
}

function bearerToken(request: IncomingMessage): string | undefined {
  return request.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{20,})$/)?.[1];
}

function requireWriteRole(identity: AuthIdentity): void {
  if (identity.role === 'viewer') throw new HttpError(403, 'read_only', 'This role has read-only access.');
}

function requireCampaignRole(identity: AuthIdentity): void {
  if (!['owner', 'manager'].includes(identity.role)) throw new HttpError(403, 'insufficient_role', 'Only owners and managers can change public campaigns.');
}

function requireOwnerRole(identity: AuthIdentity): void {
  if (identity.role !== 'owner') throw new HttpError(403, 'owner_required', 'Only an organization owner can permanently delete the account.');
}

function validateSyncPayload(payload: unknown): void {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new HttpError(400, 'invalid_sync_payload', 'Sync payload must be an object.');
  const candidate = payload as JsonObject;
  if (candidate.schemaVersion !== 1 || !Array.isArray(candidate.collections) || !candidate.business || typeof candidate.business !== 'object') throw new HttpError(400, 'invalid_sync_payload', 'Sync payload schema is not supported.');
}

function campaignDto(row: CampaignRow, publicBaseUrl: string) {
  return { id: row.id, name: row.name, slug: row.slug, destination: row.destination, color: row.color, active: Boolean(row.active), totalScans: row.total_scans, lastScanAt: row.last_scan_at, createdAt: row.created_at, updatedAt: row.updated_at, publicUrl: `${publicBaseUrl}/r/${row.slug}` };
}

function authResponse(token: string | undefined, identity: AuthIdentity, publicBaseUrl: string) {
  return { ...(token ? { token } : {}), user: { id: identity.userId, email: identity.email, name: identity.name }, organization: { id: identity.organizationId, name: identity.organizationName, role: identity.role }, service: { publicBaseUrl } };
}

function validColor(value: unknown): string {
  const color = String(value ?? '').trim();
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new HttpError(400, 'invalid_color', 'Color must be a six-digit hex value.');
  return color.toLowerCase();
}

async function readJson(request: IncomingMessage, maxBytes: number): Promise<JsonObject> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new HttpError(413, 'payload_too_large', 'Request payload is too large.');
    chunks.push(buffer);
  }
  if (!chunks.length) return {};
  const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new HttpError(400, 'invalid_json', 'JSON object expected.');
  return parsed as JsonObject;
}

function enforceRateLimit(request: IncomingMessage, limiter: RateLimiter, group: string, limit: number, windowMs: number): void {
  const address = request.socket.remoteAddress ?? 'unknown';
  if (!limiter.check(`${group}:${address}`, limit, windowMs)) throw new HttpError(429, 'rate_limited', 'Too many requests. Try again later.');
}

function setSecurityHeaders(response: ServerResponse): void {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.writeHead(status).end(JSON.stringify(body));
}

function html(response: ServerResponse, status: number, title: string, message: string): void {
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
  response.writeHead(status).end(`<!doctype html><meta name="viewport" content="width=device-width"><title>${title}</title><style>body{font:16px system-ui;max-width:36rem;margin:15vh auto;padding:1rem;color:#173f35}h1{font-size:2rem}</style><h1>${title}</h1><p>${message}</p>`);
}
