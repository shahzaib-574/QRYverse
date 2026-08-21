import type { TrackCollection, TrackRecord } from '../track/store';

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
  createdAt: number;
};
export type IntegrationSettings = { webhookUrl: string; syncEndpoint: string; customDomain: string };
export type BusinessState = {
  members: TeamMember[];
  automations: AutomationRule[];
  campaigns: DynamicCampaign[];
  integrations: IntegrationSettings;
};

export type OperationsAlert = {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  detail: string;
  collectionId: string;
  recordId: string;
};

const key = 'qry.business.v1';
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
    const raw = JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<BusinessState> | null;
    if (!raw) return defaults;
    return {
      members: Array.isArray(raw.members) ? raw.members.slice(0, 100) : defaults.members,
      automations: Array.isArray(raw.automations) ? defaults.automations.map((rule) => raw.automations?.find((item) => item.id === rule.id) ?? rule) : defaults.automations,
      campaigns: Array.isArray(raw.campaigns) ? raw.campaigns.slice(0, 250) : [],
      integrations: { ...defaults.integrations, ...raw.integrations },
    };
  } catch { return defaults; }
}

export function writeBusinessState(state: BusinessState): void {
  localStorage.setItem(key, JSON.stringify(state));
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
    scans: [{ id: makeBusinessId(), createdAt: Date.now(), source }, ...campaign.scans].slice(0, 5000),
  } : campaign) };
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
    attention: records.filter(needsAttention).length,
    completed: records.filter((record) => ['available', 'present', 'in_stock', 'passed', 'completed', 'returned'].includes(record.status)).length,
    inspections: records.reduce((sum, record) => sum + (record.inspections?.length ?? 0), 0),
  };
}

export function portfolioCsv(collections: TrackCollection[]): string {
  const quote = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = [['Workspace', 'Workflow', 'Code', 'Name', 'Status', 'Quantity', 'Location', 'Assignee', 'Priority', 'Due']];
  for (const collection of collections) for (const record of collection.records) rows.push([
    collection.name, collection.template, record.code, record.name, record.status, String(record.quantity), record.location,
    record.assignee ?? '', record.priority ?? '', record.dueAt ? new Date(record.dueAt).toISOString() : '',
  ]);
  return rows.map((row) => row.map(quote).join(',')).join('\r\n');
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

function needsAttention(record: TrackRecord): boolean {
  return ['out_of_stock', 'checked_out', 'needs_service', 'failed', 'overdue'].includes(record.status) || Boolean(record.dueAt && record.dueAt < Date.now());
}

function severityRank(value: OperationsAlert['severity']): number {
  return value === 'critical' ? 3 : value === 'warning' ? 2 : 1;
}
