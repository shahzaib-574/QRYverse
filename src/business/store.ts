import type { TrackCollection, TrackRecord } from '../track/store';
import { quoteCsvCell } from '../lib/csv';

export type TeamRole = 'owner' | 'manager' | 'operator' | 'viewer';
export type TeamMember = { id: string; name: string; email: string; role: TeamRole; active: boolean; createdAt: number };
export type AutomationKind = 'low_stock' | 'due_soon' | 'needs_service' | 'failed_inspection';
export type AutomationRule = { id: AutomationKind; enabled: boolean; threshold: number };
export type CampaignScan = { id: string; createdAt: number; source: 'camera' | 'app_link' | 'preview' };
export type DynamicCampaign = {
  id: string;
  name: string;
  destination: string;
  slug: string;
  color: string;
  active: boolean;
  scans: CampaignScan[];
  localTotalScans?: number;
  createdAt: number;
  hosted?: { publicUrl: string; totalScans: number; lastScanAt: number | null; updatedAt: number };
};
export type IntegrationSettings = { webhookUrl: string; syncEndpoint: string; customDomain: string };
export type BusinessState = {
  members: TeamMember[];
  automations: AutomationRule[];
  campaigns: DynamicCampaign[];
  integrations: IntegrationSettings;
};
export type BusinessStateChange = BusinessState | ((current: BusinessState) => BusinessState);

export type OperationsAlert = {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  detail: string;
  collectionId: string;
  recordId: string;
};

const key = 'qry.business.v1';
export const maxBusinessStorageBytes = 512 * 1024;
export const maxBusinessMembers = 100;
export const maxBusinessCampaigns = 250;
export const maxLocalCampaignScans = 250;

export class BusinessStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BusinessStorageError';
  }
}
const defaults: BusinessState = {
  members: [{ id: 'local-owner', name: 'Device owner', email: '', role: 'owner', active: true, createdAt: Date.now() }],
  automations: [
    { id: 'low_stock', enabled: true, threshold: 3 },
    { id: 'due_soon', enabled: true, threshold: 7 },
    { id: 'needs_service', enabled: true, threshold: 0 },
    { id: 'failed_inspection', enabled: true, threshold: 0 },
  ],
  campaigns: [],
  integrations: { webhookUrl: '', syncEndpoint: '', customDomain: '' },
};

export function readBusinessState(): BusinessState {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? 'null') as Record<string, unknown> | null;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaults;
    const members = uniqueBusinessIds(Array.isArray(raw.members) ? raw.members.slice(0, maxBusinessMembers).flatMap((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
      const member = value as Record<string, unknown>;
      const name = cleanBusinessText(member.name, 160);
      if (!name) return [];
      const role = ['owner', 'manager', 'operator', 'viewer'].includes(String(member.role)) ? member.role as TeamRole : 'viewer';
      return [{ id: cleanBusinessText(member.id, 120) || makeBusinessId(), name, email: cleanBusinessText(member.email, 254), role, active: member.active !== false, createdAt: safeBusinessTimestamp(member.createdAt) }];
    }) : []);
    const campaignIds = new Set<string>();
    const campaigns = Array.isArray(raw.campaigns) ? raw.campaigns.slice(0, maxBusinessCampaigns).flatMap((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
      const campaign = value as Record<string, unknown>;
      const id = cleanBusinessText(campaign.id, 120);
      const name = cleanBusinessText(campaign.name, 160);
      const destination = validHttpUrl(campaign.destination);
      if (!id || !name || !destination || campaignIds.has(id)) return [];
      campaignIds.add(id);
      const rawScans = Array.isArray(campaign.scans) ? campaign.scans : [];
      const scans = rawScans.slice(0, maxLocalCampaignScans).flatMap((value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
        const scan = value as Record<string, unknown>;
        const source = ['camera', 'app_link', 'preview'].includes(String(scan.source)) ? scan.source as CampaignScan['source'] : 'preview';
        return [{ id: cleanBusinessText(scan.id, 120) || makeBusinessId(), createdAt: safeBusinessTimestamp(scan.createdAt), source }];
      });
      const hostedRaw = campaign.hosted && typeof campaign.hosted === 'object' && !Array.isArray(campaign.hosted) ? campaign.hosted as Record<string, unknown> : undefined;
      const publicUrl = hostedRaw ? validHttpUrl(hostedRaw.publicUrl) : '';
      const hosted = publicUrl && hostedRaw ? { publicUrl, totalScans: safeNonNegativeInteger(hostedRaw.totalScans), lastScanAt: hostedRaw.lastScanAt ? safeBusinessTimestamp(hostedRaw.lastScanAt) : null, updatedAt: safeBusinessTimestamp(hostedRaw.updatedAt) } : undefined;
      return [{
        id, name, destination,
        slug: cleanBusinessText(campaign.slug, 120) || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        color: /^#[0-9a-f]{6}$/i.test(String(campaign.color)) ? String(campaign.color) : '#173f35',
        active: campaign.active !== false,
        scans,
        localTotalScans: Math.max(safeNonNegativeInteger(campaign.localTotalScans), rawScans.length, scans.length),
        createdAt: safeBusinessTimestamp(campaign.createdAt),
        hosted,
      } satisfies DynamicCampaign];
    }) : [];
    const automationSource = Array.isArray(raw.automations) ? raw.automations : [];
    const integrationSource = raw.integrations && typeof raw.integrations === 'object' && !Array.isArray(raw.integrations) ? raw.integrations as Record<string, unknown> : {};
    return {
      members: members.length ? members : defaults.members,
      automations: defaults.automations.map((fallback) => {
        const candidate = automationSource.find((value) => value && typeof value === 'object' && !Array.isArray(value) && (value as Record<string, unknown>).id === fallback.id) as Record<string, unknown> | undefined;
        return candidate ? { ...fallback, enabled: candidate.enabled !== false, threshold: Math.min(3650, safeNonNegativeInteger(candidate.threshold)) } : fallback;
      }),
      campaigns,
      integrations: { webhookUrl: cleanBusinessText(integrationSource.webhookUrl, 500), syncEndpoint: cleanBusinessText(integrationSource.syncEndpoint, 500), customDomain: cleanBusinessText(integrationSource.customDomain, 253) },
    };
  } catch { return defaults; }
}

export function writeBusinessState(state: BusinessState): void {
  if (state.members.length > maxBusinessMembers) {
    throw new BusinessStorageError(`Studio supports up to ${maxBusinessMembers} local role notes. Remove one before adding another.`);
  }
  if (state.campaigns.length > maxBusinessCampaigns) {
    throw new BusinessStorageError(`Studio supports up to ${maxBusinessCampaigns} local campaigns. Remove one before creating another.`);
  }
  const serialized = JSON.stringify(state);
  if (new TextEncoder().encode(serialized).byteLength > maxBusinessStorageBytes) {
    throw new BusinessStorageError('This Studio change was not saved because local campaign storage is full. Remove an unused local campaign and try again.');
  }
  try {
    localStorage.setItem(key, serialized);
  } catch {
    throw new BusinessStorageError('This Studio change was not saved because device storage is unavailable or full. Free app storage and try again.');
  }
}

export function businessBackupJson(state: BusinessState): string {
  return JSON.stringify({
    schemaVersion: 1,
    kind: 'qryverse-business-backup',
    exportedAt: new Date().toISOString(),
    business: state,
  }, null, 2);
}

export function parseBusinessBackup(input: string): BusinessState {
  if (new TextEncoder().encode(input).byteLength > 2 * 1024 * 1024) throw new Error('Studio backup files are limited to 2 MB.');
  let source: unknown;
  try { source = JSON.parse(input); } catch { throw new Error('This is not valid JSON.'); }
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('This is not a QRYverse Studio backup.');
  const envelope = source as Record<string, unknown>;
  if (envelope.schemaVersion !== 1 || envelope.kind !== 'qryverse-business-backup') throw new Error('This backup format is not supported.');
  if (!envelope.business || typeof envelope.business !== 'object' || Array.isArray(envelope.business)) throw new Error('This backup has no Studio data.');
  const raw = envelope.business as Record<string, unknown>;
  const memberSource = expectArray(raw.members, 'role notes');
  const campaignSource = expectArray(raw.campaigns, 'campaigns');
  if (memberSource.length > maxBusinessMembers) throw new Error(`A Studio backup can contain at most ${maxBusinessMembers} role notes.`);
  if (campaignSource.length > maxBusinessCampaigns) throw new Error(`A Studio backup can contain at most ${maxBusinessCampaigns} campaigns.`);

  const memberIds = new Set<string>();
  const members = memberSource.map((value, index) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Role note ${index + 1} is invalid.`);
    const member = value as Record<string, unknown>;
    const name = cleanBusinessText(member.name, 160);
    if (!name) throw new Error(`Role note ${index + 1} has no name.`);
    const role = ['owner', 'manager', 'operator', 'viewer'].includes(String(member.role)) ? member.role as TeamRole : 'viewer';
    const id = cleanBusinessText(member.id, 120) || makeBusinessId();
    if (memberIds.has(id)) throw new Error(`Role note ${index + 1} repeats an existing member ID.`);
    memberIds.add(id);
    return { id, name, email: cleanBusinessText(member.email, 254), role, active: member.active !== false, createdAt: safeBusinessTimestamp(member.createdAt) };
  });

  const campaignIds = new Set<string>();
  const campaigns = campaignSource.map((value, index) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Campaign ${index + 1} is invalid.`);
    const campaign = value as Record<string, unknown>;
    const id = cleanBusinessText(campaign.id, 120);
    const name = cleanBusinessText(campaign.name, 160);
    const destination = validHttpUrl(campaign.destination);
    if (!id || !name || !destination) throw new Error(`Campaign ${index + 1} is missing a valid ID, name, or HTTP(S) destination.`);
    if (campaignIds.has(id)) throw new Error(`Campaign ${index + 1} repeats an existing campaign ID.`);
    campaignIds.add(id);
    const scanSource = expectArray(campaign.scans, `campaign ${index + 1} scans`);
    if (scanSource.length > maxLocalCampaignScans) throw new Error(`Campaign ${index + 1} contains more than ${maxLocalCampaignScans} recent scan events.`);
    const scans: CampaignScan[] = scanSource.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`Campaign ${index + 1} contains an invalid scan event.`);
      const scan = item as Record<string, unknown>;
      const source = ['camera', 'app_link', 'preview'].includes(String(scan.source)) ? scan.source as CampaignScan['source'] : 'preview';
      return { id: cleanBusinessText(scan.id, 120) || makeBusinessId(), createdAt: safeBusinessTimestamp(scan.createdAt), source };
    });
    const localTotalScans = Math.max(scans.length, safeNonNegativeInteger(campaign.localTotalScans));
    return {
      id,
      name,
      destination,
      slug: cleanBusinessText(campaign.slug, 120) || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      color: /^#[0-9a-f]{6}$/i.test(String(campaign.color)) ? String(campaign.color) : '#173f35',
      active: campaign.active !== false,
      scans,
      localTotalScans,
      createdAt: safeBusinessTimestamp(campaign.createdAt),
    } satisfies DynamicCampaign;
  });

  const automationSource = Array.isArray(raw.automations) ? raw.automations : [];
  const automations = defaults.automations.map((fallback) => {
    const candidate = automationSource.find((value) => value && typeof value === 'object' && !Array.isArray(value) && (value as Record<string, unknown>).id === fallback.id) as Record<string, unknown> | undefined;
    return candidate ? { ...fallback, enabled: candidate.enabled !== false, threshold: Math.min(3650, safeNonNegativeInteger(candidate.threshold)) } : fallback;
  });
  const integrationSource = raw.integrations && typeof raw.integrations === 'object' && !Array.isArray(raw.integrations) ? raw.integrations as Record<string, unknown> : {};
  const state: BusinessState = {
    members,
    automations,
    campaigns,
    integrations: {
      webhookUrl: cleanBusinessText(integrationSource.webhookUrl, 500),
      syncEndpoint: cleanBusinessText(integrationSource.syncEndpoint, 500),
      customDomain: cleanBusinessText(integrationSource.customDomain, 253),
    },
  };
  if (new TextEncoder().encode(JSON.stringify(state)).byteLength > maxBusinessStorageBytes) throw new Error('This Studio backup is too large for safe on-device storage.');
  return state;
}

export function campaignPayload(id: string): string {
  return `qry://go/${encodeURIComponent(id)}`;
}

export function parseCampaignPayload(value: string): string | undefined {
  const match = value.trim().match(/^(?:qry:\/\/go\/|https:\/\/app\.qry\.local\/go\/)([^/?#]+)$/i);
  if (!match) return undefined;
  try { return decodeURIComponent(match[1]); } catch { return undefined; }
}

export function recordCampaignScan(state: BusinessState, campaignId: string, source: CampaignScan['source']): BusinessState {
  return { ...state, campaigns: state.campaigns.map((campaign) => campaign.id === campaignId ? {
    ...campaign,
    scans: [{ id: makeBusinessId(), createdAt: Date.now(), source }, ...campaign.scans].slice(0, maxLocalCampaignScans),
    localTotalScans: Math.max(campaign.localTotalScans ?? campaign.scans.length, campaign.scans.length) + 1,
  } : campaign) };
}

export function campaignScanCount(campaign: DynamicCampaign): number {
  return Math.max(campaign.localTotalScans ?? campaign.scans.length, campaign.scans.length, campaign.hosted?.totalScans ?? 0);
}

export function deriveAlerts(collections: TrackCollection[], state: BusinessState, now = Date.now()): OperationsAlert[] {
  const rules = new Map(state.automations.map((rule) => [rule.id, rule]));
  const alerts: OperationsAlert[] = [];
  for (const collection of collections) for (const record of collection.records) {
    const add = (id: string, severity: OperationsAlert['severity'], title: string, detail: string) => alerts.push({ id: `${id}:${collection.id}:${record.id}`, severity, title, detail, collectionId: collection.id, recordId: record.id });
    const low = rules.get('low_stock');
    if (low?.enabled && collection.template === 'inventory' && record.quantity <= low.threshold) add('stock', record.quantity === 0 ? 'critical' : 'warning', `${record.name} is low`, `${record.quantity} remaining in ${collection.name}`);
    if (rules.get('needs_service')?.enabled && record.status === 'needs_service') add('service', 'critical', `${record.name} needs service`, collection.name);
    if (rules.get('failed_inspection')?.enabled && record.status === 'failed') add('failed', 'critical', `${record.name} failed inspection`, 'Open the record to review and follow up');
    const due = rules.get('due_soon');
    if (due?.enabled && record.dueAt) {
      const days = Math.ceil((record.dueAt - now) / 86_400_000);
      if (days <= due.threshold) add('due', days < 0 ? 'critical' : 'warning', days < 0 ? `${record.name} is overdue` : `${record.name} is due soon`, days < 0 ? `${Math.abs(days)} days overdue` : `Due in ${days} days`);
    }
  }
  return alerts.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

export function operationsSummary(collections: TrackCollection[]) {
  const records = collections.flatMap((collection) => collection.records);
  return {
    workspaces: collections.length,
    records: records.length,
    attention: collections.reduce((sum, collection) => sum + collection.records.filter((record) => recordNeedsAttention(collection.template, record)).length, 0),
    completed: collections.reduce((sum, collection) => sum + collection.records.filter((record) => recordIsReady(collection.template, record)).length, 0),
    inspections: records.reduce((sum, record) => sum + (record.inspections?.length ?? 0), 0),
  };
}

export function portfolioCsv(collections: TrackCollection[]): string {
  const rows: Array<Array<string | number>> = [['Workspace', 'Workflow', 'Code', 'Name', 'Status', 'Quantity', 'Location', 'Assignee', 'Priority', 'Due']];
  for (const collection of collections) for (const record of collection.records) rows.push([
    collection.name, collection.template, record.code, record.name, record.status, record.quantity, record.location,
    record.assignee ?? '', record.priority ?? '', record.dueAt ? new Date(record.dueAt).toISOString() : '',
  ]);
  return rows.map((row) => row.map(quoteCsvCell).join(',')).join('\r\n');
}

export function initialStatus(template: TrackCollection['template'], quantity = 1): string {
  if (template === 'assets' || template === 'rentals') return 'available';
  if (template === 'attendance' || template === 'visitors') return 'not_marked';
  if (template === 'inventory') return quantity > 0 ? 'in_stock' : 'out_of_stock';
  return 'pending';
}

export function makeBusinessId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function recordNeedsAttention(template: TrackCollection['template'], record: TrackRecord, now = Date.now()): boolean {
  if (['out_of_stock', 'needs_service', 'failed', 'overdue'].includes(record.status)) return true;
  if (record.status === 'checked_out' && ['assets', 'rentals'].includes(template)) return true;
  return Boolean(record.dueAt && record.dueAt < now);
}

function recordIsReady(template: TrackCollection['template'], record: TrackRecord): boolean {
  if (record.status === 'checked_out' && ['attendance', 'visitors'].includes(template)) return true;
  return ['available', 'present', 'in_stock', 'passed', 'completed', 'returned'].includes(record.status);
}

function severityRank(value: OperationsAlert['severity']): number {
  return value === 'critical' ? 3 : value === 'warning' ? 2 : 1;
}

function expectArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`This backup has no valid ${label} list.`);
  return value;
}

function cleanBusinessText(value: unknown, limit: number): string {
  return typeof value === 'string' ? [...value].map((character) => character.charCodeAt(0) < 32 ? ' ' : character).join('').trim().slice(0, limit) : '';
}

function safeBusinessTimestamp(value: unknown): number {
  const timestamp = Number(value);
  const latest = Date.now() + 100 * 365.25 * 86_400_000;
  return Number.isFinite(timestamp) && timestamp > 0 && timestamp <= latest ? timestamp : Date.now();
}

function safeNonNegativeInteger(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function validHttpUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  try {
    const parsed = new URL(value.trim());
    return ['http:', 'https:'].includes(parsed.protocol) && parsed.hostname ? parsed.href : '';
  } catch {
    return '';
  }
}

function uniqueBusinessIds<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
