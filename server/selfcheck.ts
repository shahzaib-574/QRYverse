import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createQryServer } from './app.js';

const { server, database } = createQryServer({ databasePath: ':memory:', publicBaseUrl: 'http://127.0.0.1' });
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address() as AddressInfo;
const base = `http://127.0.0.1:${address.port}`;

type ResponseShape = Record<string, unknown>;

async function request(path: string, init: RequestInit = {}, token?: string): Promise<{ response: Response; body: ResponseShape }> {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  const body = response.status === 204 ? {} : await response.json() as ResponseShape;
  return { response, body };
}

try {
  const health = await request('/v1/health');
  assert.equal(health.response.status, 200);
  assert.deepEqual(health.body.privacy, { storesIpAddresses: false, scanAggregation: 'daily' });

  const registration = await request('/v1/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Owner One', email: 'owner@example.com', password: 'long-test-password', organizationName: 'Example One' }) });
  assert.equal(registration.response.status, 201);
  const token = String(registration.body.token);
  const userId = String((registration.body.user as ResponseShape).id);
  const organizationId = String((registration.body.organization as ResponseShape).id);
  assert.ok(token.length > 30);

  const duplicate = await request('/v1/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Other', email: 'OWNER@example.com', password: 'long-test-password', organizationName: 'Duplicate' }) });
  assert.equal(duplicate.response.status, 409);
  assert.equal(duplicate.body.error, 'email_exists');

  const invalidDestination = await request('/v1/campaigns/invalid-campaign', { method: 'PUT', body: JSON.stringify({ name: 'Unsafe', slug: 'unsafe-link', destination: 'javascript:alert(1)', color: '#173f35', active: true }) }, token);
  assert.equal(invalidDestination.response.status, 400);

  const payload = { schemaVersion: 1, deviceId: 'test-device', updatedAt: Date.now(), collections: [], business: { campaigns: [], members: [], automations: [], integrations: {} } };
  const pushed = await request('/v1/sync', { method: 'PUT', body: JSON.stringify({ baseVersion: 0, payload }) }, token);
  assert.equal(pushed.response.status, 200);
  assert.equal(pushed.body.version, 1);

  const conflict = await request('/v1/sync', { method: 'PUT', body: JSON.stringify({ baseVersion: 0, payload }) }, token);
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.body.error, 'sync_conflict');

  const campaignId = 'campaign_test_001';
  const campaign = await request(`/v1/campaigns/${campaignId}`, { method: 'PUT', body: JSON.stringify({ name: 'Summer menu', slug: 'summer-menu', destination: 'https://example.com/menu', color: '#173f35', active: true }) }, token);
  assert.equal(campaign.response.status, 200);
  assert.equal(campaign.body.publicUrl, 'http://127.0.0.1/r/summer-menu');

  const secondRegistration = await request('/v1/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Owner Two', email: 'two@example.com', password: 'another-long-password', organizationName: 'Example Two' }) });
  const secondToken = String(secondRegistration.body.token);
  const secondCampaigns = await request('/v1/campaigns', {}, secondToken);
  assert.deepEqual(secondCampaigns.body.campaigns, []);
  const tenantDelete = await request(`/v1/campaigns/${campaignId}`, { method: 'DELETE' }, secondToken);
  assert.equal(tenantDelete.response.status, 404);

  const redirect = await fetch(`${base}/r/summer-menu`, { redirect: 'manual' });
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get('location'), 'https://example.com/menu');

  const analytics = await request(`/v1/campaigns/${campaignId}/analytics`, {}, token);
  assert.equal(analytics.response.status, 200);
  assert.equal(analytics.body.total, 1);
  assert.equal((analytics.body.daily as unknown[]).length, 1);

  const paused = await request(`/v1/campaigns/${campaignId}`, { method: 'PUT', body: JSON.stringify({ name: 'Summer menu', slug: 'summer-menu', destination: 'https://example.com/menu', color: '#173f35', active: false }) }, token);
  assert.equal(paused.response.status, 200);
  assert.equal((await fetch(`${base}/r/summer-menu`, { redirect: 'manual' })).status, 410);

  assert.equal((await request('/v1/account', { method: 'DELETE' }, token)).response.status, 204);
  assert.equal((await request('/v1/me', {}, token)).response.status, 401);
  const deletedLogin = await request('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'owner@example.com', password: 'long-test-password' }) });
  assert.equal(deletedLogin.response.status, 401);
  assert.equal((await fetch(`${base}/r/summer-menu`, { redirect: 'manual' })).status, 404);
  assert.equal((database.db.prepare('SELECT COUNT(*) AS count FROM organizations WHERE id=?').get(organizationId) as { count: number }).count, 0);
  assert.equal((database.db.prepare('SELECT COUNT(*) AS count FROM users WHERE id=?').get(userId) as { count: number }).count, 0);
  assert.equal((database.db.prepare('SELECT COUNT(*) AS count FROM memberships WHERE organization_id=?').get(organizationId) as { count: number }).count, 0);
  assert.equal((database.db.prepare('SELECT COUNT(*) AS count FROM sessions WHERE user_id=?').get(userId) as { count: number }).count, 0);
  assert.equal((database.db.prepare('SELECT COUNT(*) AS count FROM sync_documents WHERE organization_id=?').get(organizationId) as { count: number }).count, 0);
  assert.equal((database.db.prepare('SELECT COUNT(*) AS count FROM campaigns WHERE organization_id=?').get(organizationId) as { count: number }).count, 0);
  assert.equal((database.db.prepare('SELECT COUNT(*) AS count FROM campaign_scan_days WHERE campaign_id=?').get(campaignId) as { count: number }).count, 0);
  assert.equal((await request('/v1/me', {}, secondToken)).response.status, 200);
  assert.equal((await request('/v1/auth/logout', { method: 'POST' }, secondToken)).response.status, 204);
  assert.equal((await request('/v1/me', {}, secondToken)).response.status, 401);
  console.log('QRYverse Cloud self-check passed: auth, isolation, sync conflicts, hosted redirects, privacy aggregation, pause, transactional account deletion, and logout.');
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
