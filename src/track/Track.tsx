import { useEffect, useMemo, useRef, useState } from 'react';
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
  Pencil,
  Plus,
  QrCode,
  RotateCcw,
  Search,
  Save,
  ShieldCheck,
  TriangleAlert,
  Tags,
  Trash2,
  UserCheck,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { exportTextFile } from '../lib/share';
import { useI18n } from '../i18n/LocaleProvider';
import {
  applyTrackAction,
  collectionActivityCsv,
  collectionCsv,
  makeTrackId,
  isTrackEvidencePhotoDataUrl,
  maxTrackEvidencePhotoCharacters,
  maxTrackActivityEvents,
  maxTrackInspectionsPerRecord,
  maxTrackRecordsPerWorkspace,
  maxTrackWorkspaces,
  nextRecordCode,
  templateInfo,
  trackPayload,
  updateTrackRecordDetails,
  type TrackAction,
  type TrackCollection,
  type TrackCollectionsChange,
  type TrackRecord,
  type TrackRecordDetails,
  type TrackTemplate,
} from './store';
import './track.css';
import { CsvImportSheet, LabelStudioSheet, RestoreSheet } from './DeploymentSheets';
import { AlertsSheet, AutomationsSheet, ReportsSheet, TeamSheet } from '../business/BusinessSheets';
import { deriveAlerts, initialStatus, recordNeedsAttention, type BusinessState, type BusinessStateChange } from '../business/store';
import '../business/business.css';

export function Track({ collections, onCollections, target, onTargetHandled, onNotice, business, onBusiness }: {
  collections: TrackCollection[];
  onCollections: (collections: TrackCollectionsChange) => boolean;
  target?: { collectionId: string; recordId: string };
  onTargetHandled: () => void;
  onNotice: (message: string) => void;
  business: BusinessState;
  onBusiness: (state: BusinessStateChange) => boolean;
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
  const returnWorkspaceIdRef = useRef<string | undefined>(undefined);

  const selected = collections.find((item) => item.id === selectedId);

  useEffect(() => {
    if (!target) return;
    const collection = collections.find((item) => item.id === target.collectionId);
    const record = collection?.records.find((item) => item.id === target.recordId);
    if (collection && record) {
      returnWorkspaceIdRef.current = collection.id;
      setSelectedId(collection.id);
      setRecordTarget(target);
    } else {
      onNotice('This QRY Track record is not on this device');
    }
    onTargetHandled();
  }, [target, collections, onNotice, onTargetHandled]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (selectedId) {
        const heading = document.querySelector<HTMLElement>('.track-screen .collection-heading h1');
        if (heading) {
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
        }
        return;
      }

      const previousId = returnWorkspaceIdRef.current;
      const previousWorkspace = previousId
        ? [...document.querySelectorAll<HTMLButtonElement>('.workspace-list [data-workspace-id]')]
          .find((button) => button.dataset.workspaceId === previousId)
        : undefined;
      const fallbackHeading = document.querySelector<HTMLElement>('.track-screen .track-title h1');
      const targetElement = previousWorkspace ?? fallbackHeading;
      if (!targetElement) return;
      if (targetElement === fallbackHeading) targetElement.tabIndex = -1;
      targetElement.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedId]);

  const replaceCollection = (updated: TrackCollection): boolean => onCollections((current) => current.map((item) => item.id === updated.id ? updated : item));
  const updateCollection = (id: string, change: (current: TrackCollection) => TrackCollection): boolean => onCollections((current) => {
    let changed = false;
    const next = current.map((item) => {
      if (item.id !== id) return item;
      const updated = change(item);
      if (updated !== item) changed = true;
      return updated;
    });
    return changed ? next : current;
  });

  return (
    <div className="screen track-screen">
      {!selected ? (
        <TrackOverview
          collections={collections}
          onOpen={(id) => {
            returnWorkspaceIdRef.current = id;
            setSelectedId(id);
          }}
          onNew={() => { if (collections.length < maxTrackWorkspaces) setNewWorkspace(true); }}
          onRestore={() => setRestoreOpen(true)}
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
          onDelete={() => {
            if (!window.confirm(`Delete “${selected.name}” and all ${selected.records.length} records? Export a backup first if you may need them.`)) return;
            if (!onCollections((current) => current.filter((item) => item.id !== selected.id))) return;
            setSelectedId(undefined);
            onNotice('Workspace deleted');
          }}
          recordLimit={maxTrackRecordsPerWorkspace}
        />
      )}

      {newWorkspace && (
        <WorkspaceSheet
          onClose={() => setNewWorkspace(false)}
          onCreate={(collection) => {
            if (!onCollections((current) => [collection, ...current])) return;
            returnWorkspaceIdRef.current = collection.id;
            setSelectedId(collection.id);
            setNewWorkspace(false);
            onNotice('Workspace created');
          }}
        />
      )}
      {restoreOpen && <RestoreSheet local={collections} onClose={() => setRestoreOpen(false)} onApply={onCollections} onNotice={onNotice} />}
      {importOpen && selected && <CsvImportSheet collection={selected} recordLimit={maxTrackRecordsPerWorkspace} onClose={() => setImportOpen(false)} onApply={replaceCollection} onNotice={onNotice} />}
      {labelsOpen && selected && <LabelStudioSheet collection={selected} onClose={() => setLabelsOpen(false)} onNotice={onNotice} />}
      {reportsOpen && <ReportsSheet collections={collections} onClose={() => setReportsOpen(false)} onNotice={onNotice} />}
      {teamOpen && <TeamSheet state={business} onState={onBusiness} onClose={() => setTeamOpen(false)} onNotice={onNotice} />}
      {automationsOpen && <AutomationsSheet state={business} onState={onBusiness} onClose={() => setAutomationsOpen(false)} onNotice={onNotice} />}
      {alertsOpen && <AlertsSheet collections={collections} state={business} onClose={() => setAlertsOpen(false)} onOpenRecord={(collectionId, recordId) => { returnWorkspaceIdRef.current = collectionId; setSelectedId(collectionId); setRecordTarget({ collectionId, recordId }); }} />}
      {newRecord && selected && (
        <RecordSheet
          collection={selected}
          onClose={() => setNewRecord(false)}
          onCreate={(record) => {
            if (!updateCollection(selected.id, (current) => ({ ...current, records: [record, ...current.records] }))) return;
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
            onDelete={() => {
              if (!window.confirm(`Delete “${record.name}” and its activity/evidence history? This cannot be undone.`)) return;
              if (!updateCollection(collection.id, (current) => ({
                ...current,
                records: current.records.filter((item) => item.id !== record.id),
                activity: current.activity.filter((item) => item.recordId !== record.id),
              }))) return;
              setRecordTarget(undefined);
              onNotice('Record deleted');
            }}
            onAction={(action, evidence) => {
              let duplicate = false;
              const saved = updateCollection(collection.id, (current) => {
                const outcome = applyTrackAction(current, record.id, action, evidence);
                duplicate = outcome.duplicate;
                return outcome.duplicate ? current : outcome.collection;
              });
              if (duplicate) onNotice('Duplicate scan: this attendance state is already recorded');
              else if (saved) onNotice('Record updated');
            }}
            onEdit={(details) => {
              const saved = updateCollection(collection.id, (current) => updateTrackRecordDetails(current, record.id, details));
              if (saved) onNotice('Record details saved');
              return saved;
            }}
          />
        );
      })()}
    </div>
  );
}

function TrackOverview({ collections, onOpen, onNew, onRestore, alertCount, onReports, onTeam, onAutomations, onAlerts }: { collections: TrackCollection[]; onOpen: (id: string) => void; onNew: () => void; onRestore: () => void; alertCount: number; onReports: () => void; onTeam: () => void; onAutomations: () => void; onAlerts: () => void }) {
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

      <div className="track-heading"><div><span>YOUR OPERATIONS</span><h2>{t('Workspaces')}</h2></div><div className="track-heading-actions"><button className="muted" onClick={onRestore}><FileJson /> {t('Restore')}</button><button disabled={collections.length >= maxTrackWorkspaces} onClick={onNew}><Plus /> {t('New')}</button></div></div>
      {collections.length === 0 ? (
        <div className="track-empty">
          <span><PackageCheck /></span><h3>{t('Start with a workflow')}</h3><p>{t('Create records, print their codes, then scan to update status or quantity.')}</p>
          <button className="solid-button" onClick={onNew}><Plus /> {t('Create workspace')}</button>
        </div>
      ) : (
        <div className="workspace-list">{collections.map((collection) => (
          <button key={collection.id} data-workspace-id={collection.id} onClick={() => onOpen(collection.id)}>
            <TemplateIcon template={collection.template} />
            <span><strong>{collection.name}</strong><small>{templateInfo[collection.template].label} · {collection.records.length} records</small></span>
            <ChevronRight />
          </button>
        ))}</div>
      )}

      <aside className="track-limit"><ShieldCheck /><span><strong>Local storage protected</strong><small>{collections.length >= maxTrackWorkspaces ? `${maxTrackWorkspaces}-workspace limit reached · Export or delete before adding more` : 'Writes are size-checked · Export backups regularly'}</small></span></aside>
    </>
  );
}

function CollectionDetail({ collection, onBack, onAdd, onOpenRecord, onNotice, onImport, onLabels, onDelete, recordLimit }: {
  collection: TrackCollection;
  onBack: () => void;
  onAdd: () => void;
  onOpenRecord: (recordId: string) => void;
  onNotice: (message: string) => void;
  onImport: () => void;
  onLabels: () => void;
  onDelete: () => void;
  recordLimit: number;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const filtered = collection.records.filter((record) => `${record.name} ${record.code} ${record.location}`.toLowerCase().includes(query.toLowerCase()));
  const active = collection.records.filter((record) => !recordNeedsAttention(collection.template, record)).length;
  const issue = collection.records.length - active;
  const exportFile = async (format: 'csv' | 'json' | 'activity') => {
    try {
      const safeName = collection.name.replace(/[^a-z\d-_]+/gi, '-').toLowerCase();
      const activity = format === 'activity';
      const content = activity ? collectionActivityCsv(collection) : format === 'csv' ? collectionCsv(collection) : JSON.stringify(collection, null, 2);
      const filename = activity ? `${safeName}-activity.csv` : `${safeName}.${format}`;
      await exportTextFile(filename, content, format === 'json' ? 'application/json' : 'text/csv');
      onNotice(`${activity ? 'Activity CSV' : format.toUpperCase()} export ready`);
    } catch { onNotice(`${format === 'activity' ? 'Activity CSV' : format.toUpperCase()} export could not be completed`); }
  };

  return (
    <>
      <button className="track-back" onClick={onBack}><ArrowLeft /> {t('All workspaces')}</button>
      <div className="collection-heading"><TemplateIcon template={collection.template} /><span><small>{templateInfo[collection.template].label}</small><h1>{collection.name}</h1></span><button className="collection-delete" onClick={onDelete} aria-label={`Delete ${collection.name}`}><Trash2 /></button></div>
      <div className="collection-stats">
        <span><strong>{collection.records.length}</strong><small>{t('Total')}</small></span>
        <span><strong>{active}</strong><small>{t('Ready')}</small></span>
        <span className={issue ? 'warn' : ''}><strong>{issue}</strong><small>{t('Attention')}</small></span>
      </div>
      <div className="export-row">
        <button onClick={onImport}><FileSpreadsheet /> {t('Import')}</button>
        <button onClick={onLabels} disabled={!collection.records.length}><Tags /> {t('Labels')}</button>
        <button onClick={() => exportFile('csv')}><Download /> CSV</button>
        <button onClick={() => exportFile('activity')} disabled={!collection.activity.length}><Clock3 /> Activity CSV</button>
        <button onClick={() => exportFile('json')}><FileJson /> {t('Backup')}</button>
      </div>
      <div className="track-heading records-heading"><div><span>RECORDS</span><h2>{t('Items')}</h2></div><button disabled={collection.records.length >= recordLimit} onClick={onAdd}><Plus /> {t('Add')}</button></div>
      {collection.records.length > 4 && <label className="track-search"><Search /><input aria-label="Search records" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search records" /></label>}
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
        <div className="track-heading activity-heading"><div><span>ACTIVITY</span><h2>{t('Latest updates')}</h2></div><small>{collection.activity.length}/{maxTrackActivityEvents} retained</small></div>
        <div className="activity-list">{collection.activity.slice(0, 5).map((activity) => <div key={activity.id}><Clock3 /><span><strong>{activity.action} · {activity.recordName}</strong><small>{activity.detail} · {relativeTime(activity.createdAt)}</small></span></div>)}</div>
        {collection.activity.length > 5 && <details className="activity-history-more"><summary>Show {collection.activity.length - 5} older retained events</summary><div className="activity-list">{collection.activity.slice(5).map((activity) => <div key={activity.id}><Clock3 /><span><strong>{activity.action} · {activity.recordName}</strong><small>{activity.detail} · {new Date(activity.createdAt).toLocaleString()}</small></span></div>)}</div></details>}
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
      <span className="sheet-kicker">QRY Track</span><h2>{t('Choose a workflow')}</h2><p className="sheet-description">Workspaces stay on this device unless you explicitly export them.</p>
      <div className="template-options">{(Object.keys(templateInfo) as TrackTemplate[]).map((item) => <button className={template === item ? 'active' : ''} aria-pressed={template === item} key={item} onClick={() => setTemplate(item)}><TemplateIcon template={item} /><span><strong>{templateInfo[item].label}</strong><small>{templateInfo[item].description}</small></span>{template === item && <Check />}</button>)}</div>
        <label className="track-field"><span>{t('Workspace name')} (required)</span><input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder={template === 'attendance' ? 'Morning class' : template === 'inventory' ? 'Main storeroom' : 'Workshop assets'} /></label>
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
  const quantityValue = boundedWholeNumber(quantity, 1_000_000);
  const intervalValue = interval ? boundedWholeNumber(interval, 3650) : undefined;
  const validNumbers = quantityValue !== undefined && (!interval || intervalValue !== undefined);
  const numberError = 'Use whole numbers from 0–1,000,000 for quantity and 0–3,650 for repeat days.';
  const submit = () => {
    if (!validNumbers) return;
    onCreate({
    id: makeTrackId(), code, name: name.trim(), location: location.trim(), notes: notes.trim(), quantity: quantityValue,
    status: initialStatus(collection.template, quantityValue),
    createdAt: Date.now(),
    assignee: assignee.trim() || undefined,
    dueAt: due ? new Date(`${due}T12:00:00`).getTime() : undefined,
    intervalDays: intervalValue,
    priority,
    checklist: checklist.split('\n').map((item) => item.trim()).filter(Boolean).slice(0, 50),
    contact: contact.trim() || undefined,
    reference: reference.trim() || undefined,
  });
  };
  return (
    <Sheet label="Add record" onClose={onClose}>
      <span className="sheet-kicker">{code}</span><h2>{t('Add a record')}</h2><p className="sheet-description">A permanent QRY label is created with it.</p>
      <div className="record-form">
        <label className="track-field"><span>{t('Name')} (required)</span><input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder={collection.template === 'attendance' ? 'Student name' : collection.template === 'inventory' ? 'Item name' : 'Asset name'} /></label>
        <label className="track-field"><span>{t('Location')}</span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Optional location" /></label>
        {collection.template === 'inventory' && <label className="track-field"><span>Starting quantity</span><input type="number" min="0" max="1000000" step="1" value={quantity} aria-invalid={quantityValue === undefined} aria-describedby={quantityValue === undefined ? 'record-number-error' : undefined} onChange={(event) => setQuantity(event.target.value)} /></label>}
        {advanced && <>
          <label className="track-field"><span>Assigned to / host</span><input value={assignee} onChange={(event) => setAssignee(event.target.value)} placeholder="Person or team" /></label>
          <div className="record-form-grid"><label className="track-field"><span>Due date</span><input type="date" value={due} onChange={(event) => setDue(event.target.value)} /></label><label className="track-field"><span>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value as TrackRecord['priority'])}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label></div>
          <label className="track-field"><span>Repeat every (days)</span><input type="number" min="0" max="3650" value={interval} aria-invalid={Boolean(interval) && intervalValue === undefined} aria-describedby={interval && intervalValue === undefined ? 'record-number-error' : undefined} onChange={(event) => setInterval(event.target.value)} placeholder="Leave blank for one-off" /></label>
          <label className="track-field"><span>Checklist</span><textarea value={checklist} onChange={(event) => setChecklist(event.target.value)} placeholder={'One checkpoint per line\nCheck guard\nConfirm power cable'} /></label>
          {['visitors', 'deliveries'].includes(collection.template) && <label className="track-field"><span>Contact</span><input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Phone or email" /></label>}
          {['vehicles', 'rentals', 'deliveries', 'training'].includes(collection.template) && <label className="track-field"><span>Reference</span><input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Registration, order, contract, or certificate" /></label>}
        </>}
        <label className="track-field"><span>{t('Notes')}</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes" /></label>
      </div>
      {!validNumbers && <p className="deployment-error" id="record-number-error" role="alert">{numberError}</p>}
      <button className="solid-button full" disabled={!name.trim() || !validNumbers} onClick={submit}>{t('Create record and code')} <QrCode /></button>
    </Sheet>
  );
}

function boundedWholeNumber(value: string, maximum: number): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && Number.isInteger(number) && number >= 0 && number <= maximum ? number : undefined;
}

function dateInputValue(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function RecordActionSheet({ collection, record, onClose, onDelete, onAction, onEdit }: {
  collection: TrackCollection;
  record: TrackRecord;
  onClose: () => void;
  onDelete: () => void;
  onAction: (action: TrackAction, evidence?: { notes?: string; performedBy?: string; photoDataUrl?: string }) => void;
  onEdit: (details: TrackRecordDetails) => boolean;
}) {
  const { t } = useI18n();
  const [qrImage, setQrImage] = useState('');
  const payload = useMemo(() => trackPayload(collection.id, record.id), [collection.id, record.id]);
  const [editing, setEditing] = useState(false);
  const [evidence, setEvidence] = useState('');
  const [performedBy, setPerformedBy] = useState(record.assignee ?? '');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [photoError, setPhotoError] = useState('');
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
      <div className="record-sheet-head"><TemplateIcon template={collection.template} /><span><small>{record.code}</small><h2>{record.name}</h2></span><button type="button" className="record-edit-button" onClick={() => setEditing((value) => !value)}>{editing ? <X /> : <Pencil />}{editing ? 'Cancel' : 'Edit details'}</button></div>
      {editing ? (
        <RecordEditForm collection={collection} record={record} onCancel={() => setEditing(false)} onSave={(details) => { if (!onEdit(details)) return; setEditing(false); }} />
      ) : <>
        <div className="record-meta"><span><small>{t('Status')}</small><strong>{humanStatus(record.status)}</strong></span>{collection.template === 'inventory' && <span><small>{t('Quantity')}</small><strong>{record.quantity}</strong></span>}{record.location && <span><small>{t('Location')}</small><strong><MapPin /> {record.location}</strong></span>}{record.dueAt && <span><small>Due</small><strong>{new Date(record.dueAt).toLocaleDateString()}</strong></span>}</div>
        <div className="record-detail-grid">
          {record.assignee && <span><small>Assigned to / host</small><strong>{record.assignee}</strong></span>}
          {record.intervalDays !== undefined && <span><small>Repeat</small><strong>{record.intervalDays ? `Every ${record.intervalDays} days` : 'One-off'}</strong></span>}
          {record.priority && <span><small>Priority</small><strong>{humanStatus(record.priority)}</strong></span>}
          {record.contact && <span><small>Contact</small><strong>{record.contact}</strong></span>}
          {record.reference && <span><small>Reference</small><strong>{record.reference}</strong></span>}
          {record.notes && <span className="wide"><small>Notes</small><strong>{record.notes}</strong></span>}
        </div>
        {record.checklist?.length ? <div className="record-checklist"><span>CHECKLIST</span>{record.checklist.map((item, index) => <label key={`${index}-${item}`}><Check /> {item}</label>)}</div> : null}
        {evidenceActions && <><div className="inspection-evidence"><label><span>Performed by</span><input maxLength={160} value={performedBy} onChange={(event) => setPerformedBy(event.target.value)} placeholder="Name or team" /></label><label><span>Evidence notes</span><textarea maxLength={500} value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Condition, readings, issues, or proof notes" /></label></div><label className={`evidence-photo ${photoError ? 'invalid' : ''}`}><span>{photoDataUrl ? <img src={photoDataUrl} alt="Evidence preview" /> : <QrCode />}</span><strong>{photoDataUrl ? 'Evidence photo ready' : 'Add evidence photo'}</strong><small>Camera or image · compressed on device</small><input type="file" accept="image/*" capture="environment" aria-invalid={Boolean(photoError)} aria-describedby={photoError ? 'evidence-photo-error' : undefined} onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setPhotoError(''); try { setPhotoDataUrl(await resizeEvidencePhoto(file)); } catch (error) { setPhotoError(error instanceof Error ? error.message : 'Photo could not be read.'); } }} /></label>{photoError && <p className="deployment-error evidence-photo-error" id="evidence-photo-error" role="alert">{photoError}</p>}{photoDataUrl && <button type="button" className="secondary-button remove-evidence-photo" onClick={() => { setPhotoDataUrl(''); setPhotoError(''); }}>Remove pending photo</button>}</>}
        <aside className="history-retention-note"><ShieldCheck /><span><strong>History retention before you update</strong><small>Track keeps the latest {maxTrackActivityEvents} events in this workspace and {maxTrackInspectionsPerRecord} inspection/completion entries per record. Export Activity CSV or a JSON backup before older entries roll off.</small></span></aside>
        <div className="quick-actions"><span>QUICK ACTION</span><div>{actions.map((action) => <button key={action.id} onClick={() => onAction(action.id, { notes: evidence, performedBy, photoDataUrl: photoDataUrl || undefined })}>{action.icon}<strong>{action.label}</strong></button>)}</div></div>
        {record.inspections?.length ? <details className="inspection-history"><summary>Full retained inspection and completion history ({record.inspections.length}/{maxTrackInspectionsPerRecord})</summary>{record.inspections.map((item) => <div key={item.id}>{item.photoDataUrl ? <img src={item.photoDataUrl} alt="Inspection evidence" /> : <StatusDot status={item.result} />}<span><strong>{humanStatus(item.result)} · {item.performedBy}</strong><small>{item.notes || 'No evidence note'} · {new Date(item.createdAt).toLocaleString()}</small></span></div>)}</details> : null}
        <details className="label-preview"><summary><QrCode /> {t('View printable label')}</summary><div>{qrImage && <img src={qrImage} alt={`QR code for ${record.name}`} />}<strong>{record.name}</strong><small>{record.code} · Scan with QRY</small></div></details>
        <button type="button" className="danger-button record-delete" onClick={onDelete}><Trash2 /> Delete record and evidence</button>
      </>}
    </Sheet>
  );
}

function RecordEditForm({ collection, record, onCancel, onSave }: { collection: TrackCollection; record: TrackRecord; onCancel: () => void; onSave: (details: TrackRecordDetails) => void }) {
  const [name, setName] = useState(record.name);
  const [location, setLocation] = useState(record.location);
  const [quantity, setQuantity] = useState(String(record.quantity));
  const [notes, setNotes] = useState(record.notes);
  const [assignee, setAssignee] = useState(record.assignee ?? '');
  const [due, setDue] = useState(record.dueAt ? dateInputValue(record.dueAt) : '');
  const [interval, setInterval] = useState(record.intervalDays === undefined ? '' : String(record.intervalDays));
  const [priority, setPriority] = useState<TrackRecord['priority']>(record.priority ?? 'normal');
  const [checklist, setChecklist] = useState((record.checklist ?? []).join('\n'));
  const [contact, setContact] = useState(record.contact ?? '');
  const [reference, setReference] = useState(record.reference ?? '');
  const quantityValue = boundedWholeNumber(quantity, 1_000_000);
  const intervalValue = interval ? boundedWholeNumber(interval, 3650) : undefined;
  const validNumbers = quantityValue !== undefined && (!interval || intervalValue !== undefined);
  const save = () => {
    if (!name.trim() || !validNumbers) return;
    onSave({
      name,
      location,
      quantity: quantityValue,
      notes,
      assignee: assignee || undefined,
      dueAt: due ? new Date(`${due}T12:00:00`).getTime() : undefined,
      intervalDays: intervalValue,
      priority,
      checklist: checklist.split('\n').map((item) => item.trim()).filter(Boolean).slice(0, 50),
      contact: contact || undefined,
      reference: reference || undefined,
    });
  };
  return <div className="record-edit-form" aria-label="Edit record details">
    <div className="record-form">
      <label className="track-field"><span>Name (required)</span><input autoFocus required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label className="track-field"><span>Location</span><input maxLength={160} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Optional location" /></label>
      {collection.template === 'inventory' && <label className="track-field"><span>Quantity</span><input type="number" min="0" max="1000000" step="1" value={quantity} aria-invalid={quantityValue === undefined} aria-describedby={quantityValue === undefined ? 'edit-record-number-error' : undefined} onChange={(event) => setQuantity(event.target.value)} /></label>}
      <label className="track-field"><span>Assigned to / host</span><input maxLength={160} value={assignee} onChange={(event) => setAssignee(event.target.value)} placeholder="Person or team" /></label>
      <div className="record-form-grid"><label className="track-field"><span>Due date</span><input type="date" value={due} onChange={(event) => setDue(event.target.value)} /></label><label className="track-field"><span>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value as TrackRecord['priority'])}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label></div>
      <label className="track-field"><span>Repeat every (days)</span><input type="number" min="0" max="3650" step="1" value={interval} aria-invalid={Boolean(interval) && intervalValue === undefined} aria-describedby={interval && intervalValue === undefined ? 'edit-record-number-error' : undefined} onChange={(event) => setInterval(event.target.value)} placeholder="Leave blank for one-off" /></label>
      <label className="track-field"><span>Checklist</span><textarea maxLength={10_050} value={checklist} onChange={(event) => setChecklist(event.target.value)} placeholder="One checkpoint per line" /></label>
      <label className="track-field"><span>Contact</span><input maxLength={160} value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Phone or email" /></label>
      <label className="track-field"><span>Reference</span><input maxLength={160} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Registration, order, contract, or certificate" /></label>
      <label className="track-field"><span>Notes</span><textarea maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes" /></label>
    </div>
    {!validNumbers && <p className="deployment-error" id="edit-record-number-error" role="alert">Use whole numbers from 0–1,000,000 for quantity and 0–3,650 for repeat days.</p>}
    <div className="record-edit-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="button" className="solid-button" disabled={!name.trim() || !validNumbers} onClick={save}><Save /> Save details</button></div>
  </div>;
}

function Sheet({ label, onClose, className = '', children }: { label: string; onClose: () => void; className?: string; children: React.ReactNode }) {
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={label}><button className="modal-backdrop" onClick={onClose} aria-label="Close" /><section className={`bottom-sheet track-sheet ${className}`}><div className="sheet-handle" /><button className="close-button floating" onClick={onClose} aria-label="Close"><X /></button>{children}</section></div>;
}

function TemplateIcon({ template }: { template: TrackTemplate }) {
  return <span className={`template-icon template-${template}`}>{['assets', 'maintenance', 'vehicles', 'rentals'].includes(template) ? <Wrench /> : ['attendance', 'visitors', 'training'].includes(template) ? <Users /> : <ClipboardCheck />}</span>;
}

function StatusDot({ status }: { status: string }) {
  const tone = ['available', 'present', 'in_stock', 'passed', 'completed', 'returned'].includes(status) ? 'good' : ['not_marked', 'pending'].includes(status) ? 'neutral' : 'warn';
  return <span className={`status-badge-record ${tone}`}><i className={`status-dot-record ${tone}`} aria-hidden="true" /><span>{humanStatus(status)}</span></span>;
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
    let width = Math.max(1, Math.round(image.naturalWidth * scale));
    let height = Math.max(1, Math.round(image.naturalHeight * scale));
    for (let attempt = 0; attempt < 7; attempt += 1) {
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Photo compression is unavailable on this device.');
      context.drawImage(image, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', Math.max(.4, .72 - attempt * .055));
      if (isTrackEvidencePhotoDataUrl(compressed)) return compressed;
      width = Math.max(1, Math.round(width * .82));
      height = Math.max(1, Math.round(height * .82));
    }
    throw new Error(`This photo could not be compressed within Track's ${Math.round(maxTrackEvidencePhotoCharacters / 1_000)} KB evidence limit. Choose a smaller image.`);
  } finally { URL.revokeObjectURL(source); }
}
