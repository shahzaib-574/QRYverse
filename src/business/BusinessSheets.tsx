import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BellRing,
  Check,
  ChevronRight,
  CloudOff,
  Download,
  Plug,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  Webhook,
  X,
} from 'lucide-react';
import { exportBinaryFile, exportTextFile } from '../lib/share';
import type { TrackCollection } from '../track/store';
import {
  deriveAlerts,
  makeBusinessId,
  operationsSummary,
  portfolioCsv,
  type AutomationKind,
  type BusinessState,
  type OperationsAlert,
  type TeamRole,
} from './store';

export function ReportsSheet({ collections, onClose, onNotice }: { collections: TrackCollection[]; onClose: () => void; onNotice: (message: string) => void }) {
  const summary = operationsSummary(collections);
  const exportReport = async () => {
    await exportTextFile('qry-operations-report.csv', portfolioCsv(collections), 'text/csv');
    onNotice('Portfolio report ready');
  };
  const exportPdf = async () => {
    const { generateOperationsReportPdf } = await import('./reports');
    await exportBinaryFile('qry-operations-report.pdf', await generateOperationsReportPdf(collections), 'application/pdf');
    onNotice('Branded PDF report ready');
  };
  return <Sheet label="Operations reports" onClose={onClose}>
    <span className="sheet-kicker">REPORTING</span><h2>Operations overview</h2><p className="sheet-description">A device-local summary across every workspace.</p>
    <div className="business-kpis">
      <span><strong>{summary.records}</strong><small>Records</small></span><span><strong>{summary.completed}</strong><small>Ready</small></span><span className={summary.attention ? 'warn' : ''}><strong>{summary.attention}</strong><small>Attention</small></span><span><strong>{summary.inspections}</strong><small>Inspections</small></span>
    </div>
    <div className="report-workspaces">{collections.map((collection) => {
      const attention = collection.records.filter((record) => ['out_of_stock', 'checked_out', 'needs_service', 'failed'].includes(record.status) || Boolean(record.dueAt && record.dueAt < Date.now())).length;
      return <div key={collection.id}><BarChart3 /><span><strong>{collection.name}</strong><small>{collection.records.length} records · {attention} need attention</small></span><b>{collection.activity.length}</b></div>;
    })}</div>
    <div className="report-actions"><button disabled={!summary.records} onClick={exportReport}><Download /> Portfolio CSV</button><button className="primary" disabled={!summary.records} onClick={exportPdf}><Download /> Branded PDF</button></div>
  </Sheet>;
}

export function TeamSheet({ state, onState, onClose, onNotice }: { state: BusinessState; onState: (state: BusinessState) => void; onClose: () => void; onNotice: (message: string) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('operator');
  const add = () => {
    if (!name.trim()) return;
    onState({ ...state, members: [...state.members, { id: makeBusinessId(), name: name.trim(), email: email.trim(), role, active: true, createdAt: Date.now() }] });
    setName(''); setEmail(''); onNotice('Team member added locally');
  };
  return <Sheet label="Team and permissions" onClose={onClose}>
    <span className="sheet-kicker">ACCESS</span><h2>Team and roles</h2><p className="sheet-description">Prepare access rules locally. Invites activate after cloud sync is connected.</p>
    <div className="team-list">{state.members.map((member) => <div key={member.id}><span className="team-avatar"><UserRound /></span><span><strong>{member.name}</strong><small>{member.email || 'This device'} · {member.role}</small></span><button disabled={member.role === 'owner'} onClick={() => onState({ ...state, members: state.members.filter((item) => item.id !== member.id) })} aria-label={`Remove ${member.name}`}><Trash2 /></button></div>)}</div>
    <div className="team-form"><label><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Team member" /></label><label><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" /></label><label><span>Role</span><select value={role} onChange={(event) => setRole(event.target.value as TeamRole)}><option value="manager">Manager</option><option value="operator">Operator</option><option value="viewer">Viewer</option></select></label></div>
    <button className="solid-button full" disabled={!name.trim()} onClick={add}><Plus /> Add member</button>
    <div className="cloud-boundary"><CloudOff /><span><strong>Invites are staged</strong><small>Role assignments are stored locally in this beta; enforcement and invitations require authenticated cloud sync.</small></span></div>
  </Sheet>;
}

export function AutomationsSheet({ state, onState, onClose, onNotice }: { state: BusinessState; onState: (state: BusinessState) => void; onClose: () => void; onNotice: (message: string) => void }) {
  const labels: Record<AutomationKind, [string, string]> = {
    low_stock: ['Low stock', 'Alert when inventory reaches the threshold'],
    due_soon: ['Due soon', 'Warn before maintenance, inspection, or renewal dates'],
    needs_service: ['Service required', 'Surface assets and rentals needing repair'],
    failed_inspection: ['Failed inspection', 'Escalate failed safety and facility checks'],
  };
  const updateRule = (id: AutomationKind, change: Partial<BusinessState['automations'][number]>) => onState({ ...state, automations: state.automations.map((rule) => rule.id === id ? { ...rule, ...change } : rule) });
  const updateIntegration = (field: keyof BusinessState['integrations'], value: string) => onState({ ...state, integrations: { ...state.integrations, [field]: value } });
  const testWebhook = async () => {
    if (!state.integrations.webhookUrl) return;
    try {
      const response = await fetch(state.integrations.webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'qry.test', createdAt: new Date().toISOString() }) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      onNotice('Webhook test delivered');
    } catch { onNotice('Webhook could not be reached from this device'); }
  };
  return <Sheet label="Alerts and integrations" onClose={onClose}>
    <span className="sheet-kicker">AUTOMATION</span><h2>Alerts and integrations</h2><p className="sheet-description">Rules run on-device whenever QRY opens or data changes.</p>
    <div className="automation-list">{state.automations.map((rule) => <label key={rule.id}><span><strong>{labels[rule.id][0]}</strong><small>{labels[rule.id][1]}</small></span>{['low_stock', 'due_soon'].includes(rule.id) && <input aria-label={`${labels[rule.id][0]} threshold`} type="number" min="0" max="365" value={rule.threshold} onChange={(event) => updateRule(rule.id, { threshold: Math.max(0, Number(event.target.value) || 0) })} />}<input className="switch-input" type="checkbox" checked={rule.enabled} onChange={(event) => updateRule(rule.id, { enabled: event.target.checked })} /><i /></label>)}</div>
    <div className="integration-fields"><div className="section-title"><Plug /><span><strong>Connection endpoints</strong><small>Optional infrastructure for Business deployments</small></span></div><label><span>Webhook URL</span><input type="url" value={state.integrations.webhookUrl} onChange={(event) => updateIntegration('webhookUrl', event.target.value.trim())} placeholder="https://automation.example/hooks/qry" /></label><button disabled={!state.integrations.webhookUrl} onClick={testWebhook}><Webhook /> Send test event</button><label><span>Sync API endpoint</span><input type="url" value={state.integrations.syncEndpoint} onChange={(event) => updateIntegration('syncEndpoint', event.target.value.trim())} placeholder="https://api.example/qry/sync" /></label><label><span>Custom domain</span><input value={state.integrations.customDomain} onChange={(event) => updateIntegration('customDomain', event.target.value.trim())} placeholder="go.example.com" /></label></div>
    <div className="cloud-boundary"><ShieldCheck /><span><strong>No hidden network traffic</strong><small>QRY contacts an endpoint only when you explicitly test or later activate a reviewed remote adapter.</small></span></div>
  </Sheet>;
}

export function AlertsSheet({ collections, state, onOpenRecord, onClose }: { collections: TrackCollection[]; state: BusinessState; onOpenRecord: (collectionId: string, recordId: string) => void; onClose: () => void }) {
  const alerts = useMemo(() => deriveAlerts(collections, state), [collections, state]);
  return <Sheet label="Operations alerts" onClose={onClose}>
    <span className="sheet-kicker">ALERT CENTER</span><h2>{alerts.length ? `${alerts.length} items need attention` : 'Everything looks ready'}</h2><p className="sheet-description">Generated from your active on-device automation rules.</p>
    {alerts.length ? <div className="alerts-list">{alerts.map((alert) => <button key={alert.id} className={alert.severity} onClick={() => { onOpenRecord(alert.collectionId, alert.recordId); onClose(); }}><AlertIcon alert={alert} /><span><strong>{alert.title}</strong><small>{alert.detail}</small></span><ChevronRight /></button>)}</div> : <div className="alerts-empty"><Check /><strong>No active alerts</strong><small>Due dates, stock, service states, and inspections are being monitored.</small></div>}
  </Sheet>;
}

function AlertIcon({ alert }: { alert: OperationsAlert }) {
  return alert.severity === 'critical' ? <AlertTriangle /> : <BellRing />;
}

function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={label}><button className="modal-backdrop" onClick={onClose} aria-label="Close" /><section className="bottom-sheet track-sheet business-sheet"><div className="sheet-handle" /><button className="close-button floating" onClick={onClose} aria-label="Close"><X /></button>{children}</section></div>;
}
