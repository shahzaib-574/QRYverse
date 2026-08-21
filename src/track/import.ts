import { makeTrackId, nextRecordCode, type TrackCollection, type TrackRecord } from './store';
import { initialStatus } from '../business/store';

export type ImportField = 'name' | 'code' | 'location' | 'quantity' | 'notes';
export type ColumnMapping = Partial<Record<ImportField, number>>;

export type CsvData = {
  headers: string[];
  rows: string[][];
};

export type ImportPreview = {
  records: TrackRecord[];
  skipped: number;
  errors: string[];
};

export function parseCsv(input: string): CsvData {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(cell.trim()); cell = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);

  if (quoted) throw new Error('The CSV has an unclosed quoted value.');
  if (rows.length < 2) throw new Error('The CSV must contain a header and at least one data row.');
  const [headers, ...dataRows] = rows;
  if (headers.length > 100) throw new Error('The CSV contains too many columns.');
  if (dataRows.length > 5000) throw new Error('Import is limited to 5,000 rows at a time.');
  return { headers: headers.map((header, index) => header || `Column ${index + 1}`), rows: dataRows };
}

export function suggestMapping(headers: string[]): ColumnMapping {
  const normalized = headers.map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const find = (...names: string[]) => normalized.findIndex((header) => names.includes(header));
  const mapping: ColumnMapping = {};
  const candidates: Array<[ImportField, number]> = [
    ['name', find('name', 'item', 'itemname', 'asset', 'student', 'attendee', 'title')],
    ['code', find('code', 'id', 'sku', 'assetid', 'studentid', 'reference')],
    ['location', find('location', 'room', 'shelf', 'department', 'class')],
    ['quantity', find('quantity', 'qty', 'stock', 'count')],
    ['notes', find('notes', 'note', 'description', 'details')],
  ];
  for (const [field, index] of candidates) if (index >= 0) mapping[field] = index;
  return mapping;
}

export function buildImportPreview(
  collection: TrackCollection,
  data: CsvData,
  mapping: ColumnMapping,
  duplicateMode: 'skip' | 'replace',
): ImportPreview {
  if (mapping.name === undefined) return { records: [], skipped: data.rows.length, errors: ['Choose a column for Name.'] };
  const byCode = new Map(collection.records.map((record) => [record.code.toLowerCase(), record]));
  const records: TrackRecord[] = [];
  const errors: string[] = [];
  let skipped = 0;
  let virtual = collection;

  data.rows.forEach((row, index) => {
    const name = valueAt(row, mapping.name).trim();
    if (!name) { skipped += 1; errors.push(`Row ${index + 2}: name is empty.`); return; }
    const suppliedCode = valueAt(row, mapping.code).trim();
    const existing = suppliedCode ? byCode.get(suppliedCode.toLowerCase()) : undefined;
    if (existing && duplicateMode === 'skip') { skipped += 1; return; }
    const quantityValue = valueAt(row, mapping.quantity).trim();
    const quantity = quantityValue ? Number(quantityValue) : 1;
    if (!Number.isFinite(quantity) || quantity < 0) { skipped += 1; errors.push(`Row ${index + 2}: quantity is invalid.`); return; }

    const record: TrackRecord = {
      id: existing?.id ?? makeTrackId(),
      code: suppliedCode || nextRecordCode(virtual),
      name,
      status: initialStatus(collection.template, quantity),
      quantity,
      location: valueAt(row, mapping.location).trim(),
      notes: valueAt(row, mapping.notes).trim(),
      createdAt: existing?.createdAt ?? Date.now(),
    };
    records.push(record);
    virtual = { ...virtual, records: [record, ...virtual.records] };
    byCode.set(record.code.toLowerCase(), record);
  });
  return { records, skipped, errors: errors.slice(0, 20) };
}

export function applyImportedRecords(collection: TrackCollection, preview: ImportPreview): TrackCollection {
  const importedIds = new Set(preview.records.map((record) => record.id));
  return { ...collection, records: [...preview.records, ...collection.records.filter((record) => !importedIds.has(record.id))] };
}

export type BackupPreview = {
  collections: TrackCollection[];
  recordCount: number;
  warnings: string[];
};

export function parseBackup(input: string): BackupPreview {
  let source: unknown;
  try { source = JSON.parse(input); } catch { throw new Error('This is not valid JSON.'); }
  const candidates = Array.isArray(source) ? source : [source];
  if (candidates.length === 0 || candidates.length > 100) throw new Error('Backup must contain between 1 and 100 workspaces.');
  const warnings: string[] = [];
  const collections = candidates.map((candidate, index) => sanitizeCollection(candidate, index, warnings));
  const recordCount = collections.reduce((sum, collection) => sum + collection.records.length, 0);
  if (recordCount > 10_000) throw new Error('Backup contains more than 10,000 records.');
  return { collections, recordCount, warnings };
}

export function mergeBackup(local: TrackCollection[], incoming: TrackCollection[]): TrackCollection[] {
  const merged = new Map(local.map((collection) => [collection.id, collection]));
  for (const imported of incoming) {
    const current = merged.get(imported.id);
    if (!current) { merged.set(imported.id, imported); continue; }
    const records = new Map(current.records.map((record) => [record.id, record]));
    imported.records.forEach((record) => records.set(record.id, record));
    const activity = new Map(current.activity.map((event) => [event.id, event]));
    imported.activity.forEach((event) => activity.set(event.id, event));
    merged.set(imported.id, {
      ...current,
      name: imported.name,
      template: imported.template,
      records: [...records.values()],
      activity: [...activity.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 500),
    });
  }
  return [...merged.values()];
}

function valueAt(row: string[], index: number | undefined): string {
  return index === undefined ? '' : (row[index] ?? '');
}

function sanitizeCollection(value: unknown, index: number, warnings: string[]): TrackCollection {
  if (!value || typeof value !== 'object') throw new Error(`Workspace ${index + 1} is invalid.`);
  const raw = value as Record<string, unknown>;
  const template = raw.template;
  if (!['assets', 'attendance', 'inventory', 'maintenance', 'inspection', 'visitors', 'vehicles', 'rentals', 'facilities', 'deliveries', 'training'].includes(String(template))) throw new Error(`Workspace ${index + 1} has an unsupported template.`);
  if (!Array.isArray(raw.records)) throw new Error(`Workspace ${index + 1} has no record list.`);
  const id = cleanText(raw.id, 120) || makeTrackId();
  const name = cleanText(raw.name, 120) || `Restored workspace ${index + 1}`;
  const records = raw.records.slice(0, 10_000).map((record, recordIndex) => sanitizeRecord(record, recordIndex));
  if (raw.records.length > records.length) warnings.push(`${name}: extra records were omitted.`);
  const activitySource = Array.isArray(raw.activity) ? raw.activity : [];
  const activity = activitySource.slice(0, 500).flatMap((event) => {
    if (!event || typeof event !== 'object') return [];
    const item = event as Record<string, unknown>;
    return [{
      id: cleanText(item.id, 120) || makeTrackId(), recordId: cleanText(item.recordId, 120), recordName: cleanText(item.recordName, 160),
      action: cleanText(item.action, 120), detail: cleanText(item.detail, 300), occurredAt: undefined,
      createdAt: safeTimestamp(item.createdAt),
    }];
  }).map(({ occurredAt: _unused, ...event }) => event);
  return { id, name, template: template as TrackCollection['template'], records, activity, createdAt: safeTimestamp(raw.createdAt) };
}

function sanitizeRecord(value: unknown, index: number): TrackRecord {
  if (!value || typeof value !== 'object') throw new Error(`Record ${index + 1} is invalid.`);
  const raw = value as Record<string, unknown>;
  const name = cleanText(raw.name, 160);
  if (!name) throw new Error(`Record ${index + 1} has no name.`);
  const quantity = Number(raw.quantity);
  return {
    id: cleanText(raw.id, 120) || makeTrackId(), code: cleanText(raw.code, 80) || `RESTORED-${index + 1}`, name,
    status: cleanText(raw.status, 60) || 'not_marked', quantity: Number.isFinite(quantity) && quantity >= 0 ? quantity : 0,
    location: cleanText(raw.location, 160), notes: cleanText(raw.notes, 500), createdAt: safeTimestamp(raw.createdAt),
    assignee: cleanText(raw.assignee, 160) || undefined,
    dueAt: raw.dueAt ? safeTimestamp(raw.dueAt) : undefined,
    intervalDays: Number.isFinite(Number(raw.intervalDays)) ? Math.max(0, Math.min(3650, Number(raw.intervalDays))) : undefined,
    priority: ['low', 'normal', 'high'].includes(String(raw.priority)) ? raw.priority as TrackRecord['priority'] : undefined,
    checklist: Array.isArray(raw.checklist) ? raw.checklist.slice(0, 50).map((item) => cleanText(item, 200)).filter(Boolean) : undefined,
    contact: cleanText(raw.contact, 160) || undefined,
    reference: cleanText(raw.reference, 160) || undefined,
    inspections: Array.isArray(raw.inspections) ? raw.inspections.slice(0, 100).flatMap((inspection) => {
      if (!inspection || typeof inspection !== 'object') return [];
      const item = inspection as Record<string, unknown>;
      const result = String(item.result);
      if (!['passed', 'failed', 'completed'].includes(result)) return [];
      const photoDataUrl = typeof item.photoDataUrl === 'string' && item.photoDataUrl.length <= 500_000 && /^data:image\/(?:jpeg|png|webp);base64,/i.test(item.photoDataUrl) ? item.photoDataUrl : undefined;
      return [{ id: cleanText(item.id, 120) || makeTrackId(), result: result as 'passed' | 'failed' | 'completed', notes: cleanText(item.notes, 500), performedBy: cleanText(item.performedBy, 160), createdAt: safeTimestamp(item.createdAt), photoDataUrl }];
    }) : undefined,
  };
}

function cleanText(value: unknown, limit: number): string {
  return typeof value === 'string'
    ? [...value].map((character) => character.charCodeAt(0) < 32 ? ' ' : character).join('').trim().slice(0, limit)
    : '';
}

function safeTimestamp(value: unknown): number {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now();
}
