import { useMemo, useState, type ChangeEvent } from 'react';
import {
  Check,
  ChevronRight,
  FileJson,
  FileSpreadsheet,
  Printer,
  Upload,
  X,
} from 'lucide-react';
import { exportBinaryFile } from '../lib/share';
import { useI18n } from '../i18n/LocaleProvider';
import {
  applyImportedRecords,
  buildImportPreview,
  limitImportedRecords,
  mergeBackup,
  parseBackup,
  parseCsv,
  suggestMapping,
  type ColumnMapping,
  type CsvData,
  type ImportField,
} from './import';
import type { LabelTemplate, PageFormat } from './labels';
import { maxLabelsPerPdf } from './limits';
import type { TrackCollection } from './store';

export function CsvImportSheet({ collection, recordLimit, onClose, onApply, onNotice }: {
  collection: TrackCollection;
  recordLimit: number;
  onClose: () => void;
  onApply: (collection: TrackCollection) => boolean;
  onNotice: (message: string) => void;
}) {
  const { t } = useI18n();
  const [data, setData] = useState<CsvData>();
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [mode, setMode] = useState<'skip' | 'replace'>('skip');
  const [error, setError] = useState('');
  const preview = useMemo(() => data ? buildImportPreview(collection, data, mapping, mode) : undefined, [collection, data, mapping, mode]);
  const remaining = Math.max(0, recordLimit - collection.records.length);
  const accepted = preview ? limitImportedRecords(collection, preview.records, recordLimit) : [];
  const overLimit = preview ? Math.max(0, preview.records.length - accepted.length) : 0;

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 3_000_000) throw new Error('CSV files are limited to 3 MB.');
      const parsed = parseCsv(await file.text());
      setData(parsed);
      setMapping(suggestMapping(parsed.headers));
      setError('');
    } catch (caught) {
      setData(undefined);
      setError(caught instanceof Error ? caught.message : 'The CSV could not be read.');
    }
  };
  const setField = (field: ImportField, value: string) => setMapping((current) => {
    const next = { ...current };
    if (value === '') delete next[field]; else next[field] = Number(value);
    return next;
  });
  const apply = () => {
    if (!preview || accepted.length === 0) return;
    if (!onApply(applyImportedRecords(collection, { ...preview, records: accepted }))) return;
    onNotice(`${accepted.length} record${accepted.length === 1 ? '' : 's'} imported`);
    onClose();
  };

  return (
    <Sheet label={t('Import a CSV')} onClose={onClose} className="deployment-sheet">
      <span className="sheet-kicker">{t('Bulk operations').toUpperCase()}</span><h2>{t('Import a CSV')}</h2><p className="sheet-description">{t('Map your columns, review the result, then import locally.')}</p>
      {!data ? <><FileDrop accept=".csv,text/csv" icon={<FileSpreadsheet />} title={t('Choose a CSV file')} detail={t('Header row required · Up to 5,000 rows')} browseLabel={t('Browse files')} onChange={chooseFile} /><a className="template-download" href="/templates/qry-track-import-template.csv" download>{t('Download CSV template')}</a></> : <>
        <div className="import-summary"><FileSpreadsheet /><span><strong>{data.rows.length} {t('rows found')}</strong><small>{data.headers.length} {t('columns')} · {remaining} {t('record spaces available')}</small></span><button onClick={() => setData(undefined)}>{t('Change')}</button></div>
        <div className="mapping-grid">
          {(['name', 'code', 'location', 'quantity', 'notes'] as ImportField[]).map((field) => <label key={field}><span>{t(field[0].toUpperCase() + field.slice(1))}{field === 'name' ? ' *' : ''}</span><select value={mapping[field] ?? ''} onChange={(event) => setField(field, event.target.value)}><option value="">{t('Not imported')}</option>{data.headers.map((header, index) => <option value={index} key={`${header}-${index}`}>{header}</option>)}</select></label>)}
        </div>
        <div className="duplicate-choice"><span>{t('When a code already exists')}</span><div><button className={mode === 'skip' ? 'active' : ''} aria-pressed={mode === 'skip'} onClick={() => setMode('skip')}>{t('Skip row')}</button><button className={mode === 'replace' ? 'active' : ''} aria-pressed={mode === 'replace'} onClick={() => setMode('replace')}>{t('Update record')}</button></div></div>
        {preview && <div className="preview-box"><div><strong>{accepted.length} {t('ready')}</strong><span>{preview.skipped} {t('skipped')}{overLimit ? ` · ${overLimit} ${t('over workspace limit')}` : ''}</span></div>{preview.errors.length > 0 && <ul>{preview.errors.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul>}</div>}
      </>}
      {error && <p className="deployment-error">{error}</p>}
      <button className="solid-button full" disabled={!preview || accepted.length === 0} onClick={apply}>{t('Import records')}{accepted.length ? ` (${accepted.length})` : ''} <ChevronRight /></button>
    </Sheet>
  );
}

export function RestoreSheet({ local, onClose, onApply, onNotice }: {
  local: TrackCollection[];
  onClose: () => void;
  onApply: (collections: TrackCollection[]) => boolean;
  onNotice: (message: string) => void;
}) {
  const { t } = useI18n();
  const [preview, setPreview] = useState<ReturnType<typeof parseBackup>>();
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [error, setError] = useState('');
  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 8_000_000) throw new Error('Backup files are limited to 8 MB.');
      setPreview(parseBackup(await file.text()));
      setError('');
    } catch (caught) {
      setPreview(undefined);
      setError(caught instanceof Error ? caught.message : 'The backup could not be read.');
    }
  };
  const restore = () => {
    if (!preview) return;
    if (mode === 'replace' && !window.confirm('Replace every local QRYverse workspace with this backup? This cannot be undone unless you exported another backup.')) return;
    try {
      if (!onApply(mode === 'merge' ? mergeBackup(local, preview.collections) : preview.collections)) return;
      onNotice(`${preview.recordCount} records restored`);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The backup could not be merged.');
    }
  };
  return (
    <Sheet label={t('Restore a backup')} onClose={onClose} className="deployment-sheet">
      <span className="sheet-kicker">{t('Device recovery').toUpperCase()}</span><h2>{t('Restore a backup')}</h2><p className="sheet-description">{t('Nothing changes until you confirm how to restore it.')}</p>
      {!preview ? <FileDrop accept=".json,application/json" icon={<FileJson />} title={t('Choose a QRY JSON backup')} detail={t('The file is validated before restore')} browseLabel={t('Browse files')} onChange={chooseFile} /> : <>
        <div className="restore-summary"><Check /><span><strong>{preview.collections.length} {t('workspaces')}</strong><small>{preview.recordCount} {t('records')} · {preview.warnings.length ? `${preview.warnings.length} ${t('warnings')}` : t('Validation passed')}</small></span></div>
        <div className="restore-options">
          <button className={mode === 'merge' ? 'active' : ''} aria-pressed={mode === 'merge'} onClick={() => setMode('merge')}><strong>{t('Merge safely')}</strong><small>{t('Keep local data and update matching IDs')}</small></button>
          <button className={mode === 'replace' ? 'active danger' : ''} aria-pressed={mode === 'replace'} onClick={() => setMode('replace')}><strong>{t('Replace this device')}</strong><small>{t('Use only the workspaces in this backup')}</small></button>
        </div>
      </>}
      {error && <p className="deployment-error">{error}</p>}
      <button className={`solid-button full ${mode === 'replace' ? 'danger-action' : ''}`} disabled={!preview} onClick={restore}>{t(mode === 'merge' ? 'Merge backup' : 'Replace local data')} <ChevronRight /></button>
    </Sheet>
  );
}

export function LabelStudioSheet({ collection, onClose, onNotice }: {
  collection: TrackCollection;
  onClose: () => void;
  onNotice: (message: string) => void;
}) {
  const { t } = useI18n();
  const [pageFormat, setPageFormat] = useState<PageFormat>('a4');
  const [template, setTemplate] = useState<LabelTemplate>('standard');
  const [batchIndex, setBatchIndex] = useState(0);
  const batches = Math.max(1, Math.ceil(collection.records.length / maxLabelsPerPdf));
  const visibleRecords = collection.records.slice(batchIndex * maxLabelsPerPdf, (batchIndex + 1) * maxLabelsPerPdf);
  const [selected, setSelected] = useState(() => new Set(collection.records.slice(0, maxLabelsPerPdf).map((record) => record.id)));
  const [busy, setBusy] = useState(false);
  const counts: Record<LabelTemplate, number> = { compact: 24, standard: 10, large: 6 };
  const toggle = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else if (next.size < maxLabelsPerPdf) next.add(id); return next; });
  const chooseBatch = (index: number) => {
    setBatchIndex(index);
    setSelected(new Set(collection.records.slice(index * maxLabelsPerPdf, (index + 1) * maxLabelsPerPdf).map((record) => record.id)));
  };
  const generate = async () => {
    setBusy(true);
    try {
      const { generateLabelPdf } = await import('./labels');
      const bytes = await generateLabelPdf(collection, { pageFormat, template, recordIds: [...selected] });
      const safeName = collection.name.replace(/[^a-z\d-_]+/gi, '-').toLowerCase();
      await exportBinaryFile(`${safeName}-labels.pdf`, bytes, 'application/pdf');
      onNotice('Print-ready label PDF created');
      onClose();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'The label PDF could not be created');
    } finally { setBusy(false); }
  };
  return (
    <Sheet label={t('Label Studio')} onClose={onClose} className="deployment-sheet label-studio-sheet">
      <span className="sheet-kicker">{t('Label Studio').toUpperCase()}</span><h2>{t('Print your workspace')}</h2><p className="sheet-description">{t('Every label includes a QR code, name, human-readable ID, and optional location.')}</p>
      <div className="label-config">
        <label><span>{t('Paper')}</span><select value={pageFormat} onChange={(event) => setPageFormat(event.target.value as PageFormat)}><option value="a4">A4</option><option value="letter">US Letter</option></select></label>
        <label><span>{t('Label size')}</span><select value={template} onChange={(event) => setTemplate(event.target.value as LabelTemplate)}><option value="compact">{t('Compact')} · 24/{t('per page')}</option><option value="standard">{t('Standard')} · 10/{t('per page')}</option><option value="large">{t('Large')} · 6/{t('per page')}</option></select></label>
        {batches > 1 && <label><span>Record batch</span><select value={batchIndex} onChange={(event) => chooseBatch(Number(event.target.value))}>{Array.from({ length: batches }, (_, index) => <option key={index} value={index}>{index * maxLabelsPerPdf + 1}–{Math.min((index + 1) * maxLabelsPerPdf, collection.records.length)}</option>)}</select></label>}
      </div>
      <p className="label-print-note">{t('Print at 100% or Actual size for accurate label spacing.')} PDFs are safely batched at {maxLabelsPerPdf} labels and currently support Latin-script text; use JSON for other scripts.</p>
      <div className="label-count"><Printer /><span><strong>{selected.size} {t('labels selected')}</strong><small>{Math.ceil(selected.size / counts[template]) || 0} {t('PDF pages')}</small></span><button onClick={() => setSelected(selected.size === visibleRecords.length ? new Set() : new Set(visibleRecords.map((record) => record.id)))}>{selected.size === visibleRecords.length ? t('Clear') : t('All')}</button></div>
      <div className="label-records">{visibleRecords.map((record) => <label key={record.id}><input type="checkbox" checked={selected.has(record.id)} onChange={() => toggle(record.id)} /><i>{selected.has(record.id) && <Check />}</i><span><strong>{record.name}</strong><small>{record.code}{record.location ? ` · ${record.location}` : ''}</small></span></label>)}</div>
      <button className="solid-button full" disabled={!selected.size || busy} onClick={generate}>{t(busy ? 'Building PDF…' : 'Create label PDF')} <Printer /></button>
    </Sheet>
  );
}

function FileDrop({ accept, icon, title, detail, browseLabel, onChange }: { accept: string; icon: React.ReactNode; title: string; detail: string; browseLabel: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return <label className="deployment-drop">{icon}<strong>{title}</strong><small>{detail}</small><span><Upload /> {browseLabel}</span><input type="file" accept={accept} onChange={onChange} /></label>;
}

function Sheet({ label, onClose, className = '', children }: { label: string; onClose: () => void; className?: string; children: React.ReactNode }) {
  const { t } = useI18n();
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={label}><button className="modal-backdrop" onClick={onClose} aria-label={t('Close')} /><section className={`bottom-sheet track-sheet ${className}`}><div className="sheet-handle" /><button className="close-button floating" onClick={onClose} aria-label={t('Close')}><X /></button>{children}</section></div>;
}
