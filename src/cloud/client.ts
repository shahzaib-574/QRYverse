import type { DynamicCampaign } from '../business/store';
import { resolveCloudAccountAvailability, resolveDefaultCloudApiBase } from './config';

export type CloudRole = 'owner' | 'manager' | 'operator' | 'viewer';
export type CloudAuthSession = {
  token: string;
  user: { id: string; email: string; name: string };
  organization: { id: string; name: string; role: CloudRole };
  service: { publicBaseUrl: string };
};
export type CloudSyncDocument<T> = { version: number; payload: T | null; updatedAt: number };
export type HostedCampaign = {
  id: string;
  name: string;
  slug: string;
  destination: string;
  color: string;
  active: boolean;
  totalScans: number;
  lastScanAt: number | null;
  createdAt: number;
  updatedAt: number;
  publicUrl: string;
};

export class CloudApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: unknown) { super(message); }
}

export class CloudClient {
  readonly apiBase: string;
  private token?: string;

  constructor(apiBase: string, token?: string) {
    this.apiBase = normalizeCloudApiBase(apiBase);
    this.token = token;
  }

  setToken(token?: string): void { this.token = token; }

  register(input: { name: string; email: string; password: string; organizationName: string }): Promise<CloudAuthSession> {
    return this.request('/v1/auth/register', { method: 'POST', body: JSON.stringify(input) });
  }

  login(email: string, password: string): Promise<CloudAuthSession> {
    return this.request('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  }

  async logout(): Promise<void> {
    await this.request('/v1/auth/logout', { method: 'POST' });
    this.token = undefined;
  }

  async deleteAccount(): Promise<void> {
    await this.request('/v1/account', { method: 'DELETE' });
    this.token = undefined;
  }

  getSync<T>(): Promise<CloudSyncDocument<T>> { return this.request('/v1/sync'); }

  putSync<T>(baseVersion: number, payload: T): Promise<CloudSyncDocument<T>> {
    return this.request('/v1/sync', { method: 'PUT', body: JSON.stringify({ baseVersion, payload }) });
  }

  async listCampaigns(): Promise<HostedCampaign[]> {
    const result = await this.request<{ campaigns: HostedCampaign[] }>('/v1/campaigns');
    return result.campaigns;
  }

  upsertCampaign(campaign: DynamicCampaign): Promise<HostedCampaign> {
    return this.request(`/v1/campaigns/${encodeURIComponent(campaign.id)}`, { method: 'PUT', body: JSON.stringify({ name: campaign.name, slug: campaign.slug, destination: campaign.destination, color: campaign.color, active: campaign.active }) });
  }

  async deleteCampaign(id: string): Promise<void> {
    await this.request(`/v1/campaigns/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.apiBase}${path}`, {
      ...init,
      headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}), ...init.headers },
    });
    if (response.status === 204) return undefined as T;
    const body = await response.json().catch(() => ({})) as { error?: string; message?: string; current?: unknown };
    if (!response.ok) throw new CloudApiError(response.status, body.error ?? 'request_failed', body.message ?? `Cloud request failed with HTTP ${response.status}.`, body.current);
    return body as T;
  }
}

export function normalizeCloudApiBase(value: string): string {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error('Enter a valid cloud service URL.'); }
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('Cloud connections require HTTPS. HTTP is allowed only for local development.');
  if (url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) throw new Error('Cloud service URL must be an origin without credentials, a path, query, or fragment.');
  return url.toString().replace(/\/+$/, '');
}

export function cloudAccountAvailable(): boolean {
  return resolveCloudAccountAvailability(import.meta.env.VITE_QRY_CLOUD_API_URL, import.meta.env.DEV);
}

export function defaultCloudApiBase(): string {
  return resolveDefaultCloudApiBase(import.meta.env.VITE_QRY_CLOUD_API_URL, import.meta.env.DEV);
}

export function cloudErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Cloud service is unavailable.';
}
