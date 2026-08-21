import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  BarChart3,
  BellRing,
  Box,
  Check,
  ChevronRight,
  CircleMinus,
  CirclePlus,
  ClipboardCheck,
  Clock3,
  Download,
  FileJson,
  FileSpreadsheet,
  Gauge,
  MapPin,
  PackageCheck,
  Plus,
  QrCode,
  RotateCcw,
  Search,
  ShieldCheck,
  TriangleAlert,
  Tags,
  UserCheck,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { exportTextFile } from '../lib/share';
import { useI18n } from '../i18n/LocaleProvider';
import {
  applyTrackAction,
  collectionCsv,
  makeTrackId,
  nextRecordCode,
  templateInfo,
  trackPayload,
  type TrackAction,
  type TrackCollection,
  type TrackRecord,
  type TrackTemplate,
} from './store';
import './track.css';
import { CsvImportSheet, LabelStudioSheet, RestoreSheet } from './DeploymentSheets';
import { AlertsSheet, AutomationsSheet, ReportsSheet, TeamSheet } from '../business/BusinessSheets';
import { deriveAlerts, initialStatus, type BusinessState } from '../business/store';
import '../business/business.css';

export function Track({ collections, onCollections, target, onTargetHandled, onNotice, pro, business, onBusiness }: {
  collections: TrackCollection[];
  onCollections: (collections: TrackCollection[]) => void;
  target?: { collectionId: string; recordId: string };
  onTargetHandled: () => void;
  onNotice: (message: string) => void;
  pro: boolean;
  business: BusinessState;
  onBusiness: (state: BusinessState) => void;
}) {
  const [selectedId, setSelectedId] = useState<string>();
  const [newWorkspace, setNewWorkspace] = useState(false);
  const [newRecord, setNewRecord] = useState(false);
  const [recordTarget, setRecordTarget] = useState<{ collectionId: string; recordId: string }>();
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [automationsOpen, setAutomationsOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);

  const selected = collections.find((item) => item.id === selectedId);

  useEffect(() => {
    if (!target) return;
    const collection = collections.find((item) => item.id === target.collectionId);
    const record = collection?.records.find((item) => item.id === target.recordId);
    if (collection && record) {
      setSelectedId(collection.id);
      setRecordTarget(target);
    } else {
      onNotice('This QRY Track record is not on this device');
    }
    onTargetHandled();
  }, [target, collections, onNotice, onTargetHandled]);

  const updateCollection = (updated: TrackCollection) => {
    onCollections(collections.map((item) => item.id === updated.id ? updated : item));
  };

  return (
    <div className="screen track-screen">
      {!selected ? (
        <TrackOverview
          collections={collections}
          onOpen={setSelectedId}
          onNew={() => {
            if (!pro && collections.length >= 1) onNotice('Track Pro unlocks additional workspaces');
            else setNewWorkspace(true);
          }}
          onRestore={() => setRestoreOpen(true)}
          pro={pro}
          alertCount={deriveAlerts(collections, business).length}
          onReports={() => setReportsOpen(true)}
          onTeam={() => setTeamOpen(true)}
          onAutomations={() => setAutomationsOpen(true)}
          onAlerts={() => setAlertsOpen(true)}
        />
      ) : (
        <CollectionDetail
          collection={selected}
          onBack={() => setSelectedId(undefined)}
          onAdd={() => setNewRecord(true)}
          onOpenRecord={(recordId) => setRecordTarget({ collectionId: selected.id, recordId })}
          onNotice={onNotice}
          onImport={() => setImportOpen(true)}
          onLabels={() => setLabelsOpen(true)}
          recordLimit={pro ? 1000 : 25}
        />
      )}

      {newWorkspace && (
        <WorkspaceSheet
          onClose={() => setNewWorkspace(false)}
          onCreate={(collection) => {
            onCollections([collection, ...collections]);
            setSelectedId(collection.id);
            setNewWorkspace(false);
            onNotice('Workspace created');
          }}
        />
      )}
      {restoreOpen && <RestoreSheet local={collections} onClose={() => setRestoreOpen(false)} onApply={onCollections} onNotice={onNotice} />}
      {importOpen && selected && <CsvImportSheet collection={selected} recordLimit={pro ? 1000 : 25} onClose={() => setImportOpen(false)} onApply={updateCollection} onNotice={onNotice} />}
      {labelsOpen && selected && <LabelStudioSheet collection={selected} onClose={() => setLabelsOpen(false)} onNotice={onNotice} />}
      {reportsOpen && <ReportsSheet collections={collections} onClose={() => setReportsOpen(false)} onNotice={onNotice} />}
      {teamOpen && <TeamSheet state={business} onState={onBusiness} onClose={() => setTeamOpen(false)} onNotice={onNotice} />}
      {automationsOpen && <AutomationsSheet state={business} onState={onBusiness} onClose={() => setAutomationsOpen(false)} onNotice={onNotice} />}
      {alertsOpen && <AlertsSheet collections={collections} state={business} onClose={() => setAlertsOpen(false)} onOpenRecord={(collectionId, recordId) => { setSelectedId(collectionId); setRecordTarget({ collectionId, recordId }); }} />}
      {newRecord && selected && (
        <RecordSheet
          collection={selected}
          onClose={() => setNewRecord(false)}
          onCreate={(record) => {
            updateCollection({ ...selected, records: [record, ...selected.records] });
            setNewRecord(false);
            setRecordTarget({ collectionId: selected.id, recordId: record.id });
            onNotice('Record and QR code created');
          }}
        />
      )}
      {recordTarget && (() => {
        const collection = collections.find((item) => item.id === recordTarget.collectionId);
        const record = collection?.records.find((item) => item.id === recordTarget.recordId);
        if (!collection || !record) return null;
        return (
          <RecordActionSheet
            collection={collection}
            record={record}
            onClose={() => setRecordTarget(undefined)}
            onAction={(action, evidence) => {
              const outcome = applyTrackAction(collection, record.id, action, evidence);
              if (outcome.duplicate) onNotice('Duplicate scan: this attendance state is already recorded');
              else {
                updateCollection(outcome.collection);
                onNotice('Record updated');
              }
            }}
          />
        );
      })()}
    </div>
  );
}

function TrackOverview({ collections, onOpen, onNew, onRestore, pro, alertCount, onReports, onTeam, onAutomations, onAlerts }: { collections: TrackCollection[]; onOpen: (id: string) => void; onNew: () => void; onRestore: () => void; pro: boolean; alertCount: number; onReports: () => void; onTeam: () => void; onAutomations: () => void; onAlerts: () => void }) {
  const { t } = useI18n();
  const totalRecords = collections.reduce((sum, item) => sum + item.records.length, 0);
  return (
    <>
      <div className="page-title track-title"><span>QRY Track</span><h1>{t('Scan. Update. Done.')}</h1><p>{t('Lightweight operations without a heavyweight system.')}</p></div>
      <section className="track-intro">
        <div><span className="track-badge"><Gauge /> OFFLINE READY</span><h2>{t('Turn every label into an action.')}</h2><p>{t('Track assets, attendance, and stock from the same scanner.')}</p></div>
        <QrCode />
      </section>
      <div className="track-totals">
        <span><strong>{collections.length}</strong><small>{t('Workspaces')}</small></span>
        <i />
        <span><strong>{totalRecords}</strong><small>{t('Records')}</small></span>
        <i />
        <span><strong>{t('This device')}</strong><small>{t('Storage')}</small></span>
      </div>
      <section className="operations-center"><div className="operations-center-head"><ShieldCheck /><span><strong>Business operations center</strong><small>Reports, alerts, roles, and automation</small></span>{alertCount > 0 && <b>{alertCount}</b>}</div><div className="operations-center-actions"><button onClick={onReports}><BarChart3 /> Reports</button><button onClick={onAlerts}><BellRing /> Alerts</button><button onClick={onTeam}><Users /> Team</button><button onClick={onAutomations}><Gauge /> Automate</button></div></section>

      <div className="track-heading"><div><span>YOUR OPERATIONS</span><h2>{t('Workspaces')}</h2></div><div className="track-heading-actions"><button className="muted" onClick={onRestore}><FileJson /> {t('Restore')}</button><button onClick={onNew} disabled={!pro && collections.length >= 1}><Plus /> {t('New')}</button></div></div>
      {collections.length === 0 ? (
        <div className="track-empty">
          <span><PackageCheck /></span><h3>{t('Start with a workflow')}</h3><p>{t('Create records, print their codes, then scan to update status or quantity.')}</p>
          <button className="solid-button" onClick={onNew}><Plus /> {t('Create workspace')}</button>
        </div>
      ) : (
        <div className="workspace-list">{collections.map((collection) => (
          <button key={collection.id} onClick={() => onOpen(collection.id)}>
            <TemplateIcon template={collection.template} />
            <span><strong>{collection.name}</strong><small>{templateInfo[collection.template].label} · {collection.records.length} records</small></span>
            <ChevronRight />
          </button>
        ))}</div>
      )}

      <aside className="track-limit"><ShieldCheck /><span><strong>{t('Free workspace allowance')}</strong><small>1 workspace · 25 records · Local backup</small></span></aside>
    </>
  );
}

function CollectionDetail({ collection, onBack, onAdd, onOpenRecord, onNotice, onImport, onLabels, recordLimit }: {
  collection: TrackCollection;
  onBack: () => void;
  onAdd: () => void;
  onOpenRecord: (recordId: string) => void;
  onNotice: (message: string) => void;
  onImport: () => void;
  onLabels: () => void;
  recordLimit: number;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const filtered = collection.records.filter((record) => `${record.name} ${record.code} ${record.location}`.toLowerCase().includes(query.toLowerCase()));
  const active = collection.records.filter((record) => !['out_of_stock', 'checked_out', 'needs_service', 'failed'].includes(record.status) && !(record.dueAt && record.dueAt < Date.now())).length;
  const issue = collection.records.length - active;
  const exportFile = async (format: 'csv' | 'json') => {
    const safeName = collection.name.replace(/[^a-z\d-_]+/gi, '-').toLowerCase();
    const content = format === 'csv' ? collectionCsv(collection) : JSON.stringify(collection, null, 2);
    await exportTextFile(`${safeName}.${format}`, content, format === 'csv' ? 'text/csv' : 'application/json');
    onNotice(`${format.toUpperCase()} export ready`);
  };

  return (
    <>
      <button className="track-back" onClick={onBack}><ArrowLeft /> {t('All workspaces')}</button>
      <div className="collection-heading"><TemplateIcon template={collection.template} /><span><small>{templateInfo[collection.template].label}</small><h1>{collection.name}</h1></span></div>
      <div className="collection-stats">
        <span><strong>{collection.records.length}</strong><small>{t('Total')}</small></span>
        <span><strong>{active}</strong><small>{t('Ready')}</small></span>
        <span className={issue ? 'warn' : ''}><strong>{issue}</strong><small>{t('Attention')}</small></span>
      </div>
      <div className="export-row">
        <button onClick={onImport}><FileSpreadsheet /> {t('Import')}</button>
        <button onClick={onLabels} disabled={!collection.records.length}><Tags /> {t('Labels')}</button>
        <button onClick={() => exportFile('csv')}><Download /> CSV</button>
        <button onClick={() => exportFile('json')}><FileJson /> {t('Backup')}</button>
      </div>
      <div className="track-heading records-heading"><div><span>RECORDS</span><h2>{t('Items')}</h2></div><button disabled={collection.records.length >= recordLimit} onClick={onAdd}><Plus /> {t('Add')}</button></div>
      {collection.records.length > 4 && <label className="track-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search records" /></label>}
      {filtered.length === 0 ? (
        <button className="records-empty" onClick={onAdd} disabled={collection.records.length >= recordLimit}><Box /><strong>{collection.records.length ? 'No matching records' : t('Add your first record')}</strong><small>QRY creates a unique scannable code automatically.</small></button>
      ) : (
        <div className="record-list">{filtered.map((record) => (
          <button key={record.id} onClick={() => onOpenRecord(record.id)}>
            <StatusDot status={record.status} />
            <span><strong>{record.name}</strong><small>{record.code}{record.location ? ` · ${record.location}` : ''}{record.dueAt ? ` · Due ${new Date(record.dueAt).toLocaleDateString()}` : ''}</small></span>
            {collection.template === 'inventory' && <b>{record.quantity}</b>}
            <ChevronRight />
          </button>
        ))}</div>
      )}
      {collection.records.length >= recordLimit && <p className="record-limit-note"><TriangleAlert /> Workspace record limit reached. Export remains available.</p>}
      {collection.activity.length > 0 && <>
        <div className="track-heading activity-heading"><div><span>ACTIVITY</span><h2>{t('Latest updates')}</h2></div></div>
        <div className="activity-list">{collection.activity.slice(0, 5).map((activity) => <div key={activity.id}><Clock3 /><span><strong>{activity.action} · {activity.recordName}</strong><small>{activity.detail} · {relativeTime(activity.createdAt)}</small></span></div>)}</div>
      </>}
    </>
  );
}

function WorkspaceSheet({ onClose, onCreate }: { onClose: () => void; onCreate: (collection: TrackCollection) => void }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [template, setTemplate] = useState<TrackTemplate>('assets');
  const submit = () => onCreate({ id: makeTrackId(), name: name.trim(), template, records: [], activity: [], createdAt: Date.now() });
  return (
    <Sheet label="Create operations workspace" onClose={onClose}>
      <span className="sheet-kicker">QRY Track</span><h2>{t('Choose a workflow')}</h2><p className="sheet-description">One workspace is included in the free beta.</p>
      <div className="template-options">{(Object.keys(templateInfo) as TrackTemplate[]).map((item) => <button className={template === item ? 'active' : ''} key={item} onClick={() => setTemplate(item)}><TemplateIcon template={item} /><span><strong>{templateInfo[item].label}</strong><small>{templateInfo[item].description}</small></span>{template === item && <Check />}</button>)}</div>
      <label className="track-field"><span>{t('Workspace name')}</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={template === 'attendance' ? 'Morning class' : template === 'inventory' ? 'Main storeroom' : 'Workshop assets'} /></label>
      <button className="solid-button full" disabled={!name.trim()} onClick={submit}>{t('Create workspace')} <ChevronRight /></button>
    </Sheet>
  );
}

function RecordSheet({ collection, onClose, onCreate }: { collection: TrackCollection; onClose: () => void; onCreate: (record: TrackRecord) => void }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [assignee, setAssignee] = useState('');
  const [due, setDue] = useState('');
  const [interval, setInterval] = useState('');
  const [priority, setPriority] = useState<TrackRecord['priority']>('normal');
  const [checklist, setChecklist] = useState('');
  const [contact, setContact] = useState('');
  const [reference, setReference] = useState('');
  const code = nextRecordCode(collection);
  const advanced = !['assets', 'attendance', 'inventory'].includes(collection.template);
  const submit = () => onCreate({
    id: makeTrackId(), code, name: name.trim(), location: location.trim(), notes: notes.trim(), quantity: Math.max(0, Number(quantity) || 0),
    status: initialStatus(collection.template, Number(quantity)),
    createdAt: Date.now(),
    assignee: assignee.trim() || undefined,
    dueAt: due ? new Date(`${due}T12:00:00`).getTime() : undefined,
    intervalDays: interval ? Math.max(0, Number(interval) || 0) : undefined,
    priority,
    checklist: checklist.split('\n').map((item) => item.trim()).filter(Boolean).slice(0, 50),
    contact: contact.trim() || undefined,
    reference: reference.trim() || undefined,
  });
  return (
    <Sheet label="Add record" onClose={onClose}>
      <span className="sheet-kicker">{code}</span><h2>{t('Add a record')}</h2><p className="sheet-description">A permanent QRY label is created with it.</p>
      <div className="record-form">
        <label className="track-field"><span>{t('Name')}</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={collection.template === 'attendance' ? 'Student name' : collection.template === 'inventory' ? 'Item name' : 'Asset name'} /></label>
        <label className="track-field"><span>{t('Location')}</span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Optional location" /></label>
        {collection.template === 'inventory' && <label className="track-field"><span>Starting quantity</span><input type="number" min="0" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>}
        {advanced && <>
          <label className="track-field"><span>Assigned to / host</span><input value={assignee} onChange={(event) => setAssignee(event.target.value)} placeholder="Person or team" /></label>
          <div className="record-form-grid"><label className="track-field"><span>Due date</span><input type="date" value={due} onChange={(event) => setDue(event.target.value)} /></label><label className="track-field"><span>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value as TrackRecord['priority'])}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label></div>
          <label className="track-field"><span>Repeat every (days)</span><input type="number" min="0" max="3650" value={interval} onChange={(event) => setInterval(event.target.value)} placeholder="Leave blank for one-off" /></label>
          <label className="track-field"><span>Checklist</span><textarea value={checklist} onChange={(event) => setChecklist(event.target.value)} placeholder={'One checkpoint per line\nCheck guard\nConfirm power cable'} /></label>
          {['visitors', 'deliveries'].includes(collection.template) && <label className="track-field"><span>Contact</span><input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Phone or email" /></label>}
          {['vehicles', 'rentals', 'deliveries', 'training'].includes(collection.template) && <label className="track-field"><span>Reference</span><input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Registration, order, contract, or certificate" /></label>}
        </>}
        <label className="track-field"><span>{t('Notes')}</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes" /></label>
      </div>
      <button className="solid-button full" disabled={!name.trim()} onClick={submit}>{t('Create record and code')} <QrCode /></button>
    </Sheet>
  );
}

function RecordActionSheet({ collection, record, onClose, onAction }: { collection: TrackCollection; record: TrackRecord; onClose: () => void; onAction: (action: TrackAction, evidence?: { notes?: string; performedBy?: string; photoDataUrl?: string }) => void }) {
  const { t } = useI18n();
  const [qrImage, setQrImage] = useState('');
  const payload = useMemo(() => trackPayload(collection.id, record.id), [collection.id, record.id]);
  const [evidence, setEvidence] = useState('');
  const [performedBy, setPerformedBy] = useState(record.assignee ?? '');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  useEffect(() => {
    QRCode.toDataURL(payload, { width: 540, margin: 3, errorCorrectionLevel: 'H', color: { dark: '#173f35', light: '#fffdf7' } }).then(setQrImage);
  }, [payload]);
  const actions: Array<{ id: TrackAction; label: string; icon: React.ReactNode }> = ['assets', 'rentals'].includes(collection.template)
    ? [{ id: 'checkout', label: t('Check out'), icon: <PackageCheck /> }, { id: 'return', label: t('Return'), icon: <RotateCcw /> }, { id: 'service', label: t('Needs service'), icon: <Wrench /> }]
    : ['attendance', 'visitors'].includes(collection.template)
      ? [{ id: 'present', label: t('Present'), icon: <UserCheck /> }, { id: 'late', label: t('Late'), icon: <Clock3 /> }, { id: 'leave', label: t('Check out'), icon: <ArrowLeft /> }]
      : collection.template === 'inventory'
        ? [{ id: 'add', label: t('Add one'), icon: <CirclePlus /> }, { id: 'subtract', label: t('Remove one'), icon: <CircleMinus /> }]
        : ['inspection', 'vehicles', 'facilities'].includes(collection.template)
          ? [{ id: 'pass', label: 'Pass', icon: <Check /> }, { id: 'fail', label: 'Fail', icon: <TriangleAlert /> }, { id: 'service', label: t('Needs service'), icon: <Wrench /> }]
          : [{ id: 'complete', label: 'Complete', icon: <Check /> }, { id: 'reset', label: 'Reopen', icon: <RotateCcw /> }, { id: 'service', label: t('Needs service'), icon: <Wrench /> }];
  const evidenceActions = actions.some((action) => ['pass', 'fail', 'complete'].includes(action.id));
  return (
    <Sheet label="Record actions" onClose={onClose} className="record-action-sheet">
      <div className="record-sheet-head"><TemplateIcon template={collection.template} /><span><small>{record.code}</small><h2>{record.name}</h2></span></div>
      <div className="record-meta"><span><small>{t('Status')}</small><strong>{humanStatus(record.status)}</strong></span>{collection.template === 'inventory' && <span><small>{t('Quantity')}</small><strong>{record.quantity}</strong></span>}{record.location && <span><small>{t('Location')}</small><strong><MapPin /> {record.location}</strong></span>}{record.dueAt && <span><small>Due</small><strong>{new Date(record.dueAt).toLocaleDateString()}</strong></span>}</div>
      {record.checklist?.length ? <div className="record-checklist"><span>CHECKLIST</span>{record.checklist.map((item) => <label key={item}><Check /> {item}</label>)}</div> : null}
      {evidenceActions && <><div className="inspection-evidence"><label><span>Performed by</span><input value={performedBy} onChange={(event) => setPerformedBy(event.target.value)} placeholder="Name or team" /></label><label><span>Evidence notes</span><textarea value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Condition, readings, issues, or proof notes" /></label></div><label className="evidence-photo"><span>{photoDataUrl ? <img src={photoDataUrl} alt="Evidence preview" /> : <QrCode />}</span><strong>{photoDataUrl ? 'Evidence photo ready' : 'Add evidence photo'}</strong><small>Camera or image · compressed on device</small><input type="file" accept="image/*" capture="environment" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { setPhotoDataUrl(await resizeEvidencePhoto(file)); } catch (error) { setEvidence(error instanceof Error ? error.message : 'Photo could not be read.'); } }} /></label></>}
      <div className="quick-actions"><span>QUICK ACTION</span><div>{actions.map((action) => <button key={action.id} onClick={() => onAction(action.id, { notes: evidence, performedBy, photoDataUrl: photoDataUrl || undefined })}>{action.icon}<strong>{action.label}</strong></button>)}</div></div>
      {record.inspections?.length ? <details className="inspection-history"><summary>Inspection and completion history ({record.inspections.length})</summary>{record.inspections.slice(0, 8).map((item) => <div key={item.id}>{item.photoDataUrl ? <img src={item.photoDataUrl} alt="Inspection evidence" /> : <StatusDot status={item.result} />}<span><strong>{humanStatus(item.result)} · {item.performedBy}</strong><small>{item.notes || 'No evidence note'} · {relativeTime(item.createdAt)}</small></span></div>)}</details> : null}
      <details className="label-preview"><summary><QrCode /> {t('View printable label')}</summary><div>{qrImage && <img src={qrImage} alt={`QR code for ${record.name}`} />}<strong>{record.name}</strong><small>{record.code} · Scan with QRY</small></div></details>
    </Sheet>
  );
}

function Sheet({ label, onClose, className = '', children }: { label: string; onClose: () => void; className?: string; children: React.ReactNode }) {
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={label}><button className="modal-backdrop" onClick={onClose} aria-label="Close" /><section className={`bottom-sheet track-sheet ${className}`}><div className="sheet-handle" /><button className="close-button floating" onClick={onClose} aria-label="Close"><X /></button>{children}</section></div>;
}

function TemplateIcon({ template }: { template: TrackTemplate }) {
  return <span className={`template-icon template-${template}`}>{['assets', 'maintenance', 'vehicles', 'rentals'].includes(template) ? <Wrench /> : ['attendance', 'visitors', 'training'].includes(template) ? <Users /> : <ClipboardCheck />}</span>;
}

function StatusDot({ status }: { status: string }) {
  return <span className={`status-dot-record ${['available', 'present', 'in_stock', 'passed', 'completed', 'returned'].includes(status) ? 'good' : ['not_marked', 'pending'].includes(status) ? 'neutral' : 'warn'}`} />;
}

function humanStatus(value: string): string {
  return value.split('_').map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ');
}

function relativeTime(timestamp: number): string {
  const minutes = Math.floor((Date.now() - timestamp) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

async function resizeEvidencePhoto(file: File): Promise<string> {
  if (file.size > 12_000_000) throw new Error('Evidence photos are limited to 12 MB before compression.');
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Photo could not be read.')); image.src = source; });
    const scale = Math.min(1, 960 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', .72);
  } finally { URL.revokeObjectURL(source); }
}
