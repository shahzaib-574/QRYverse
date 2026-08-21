export type TrackTemplate = 'assets' | 'attendance' | 'inventory' | 'maintenance' | 'inspection' | 'visitors' | 'vehicles' | 'rentals' | 'facilities' | 'deliveries' | 'training';

export type TrackInspection = {
  id: string;
  result: 'passed' | 'failed' | 'completed';
  notes: string;
  performedBy: string;
  createdAt: number;
  photoDataUrl?: string;
};

export type TrackRecord = {
  id: string;
  code: string;
  name: string;
  status: string;
  quantity: number;
  location: string;
  notes: string;
  createdAt: number;
  assignee?: string;
  dueAt?: number;
  intervalDays?: number;
  priority?: 'low' | 'normal' | 'high';
  checklist?: string[];
  inspections?: TrackInspection[];
  contact?: string;
  reference?: string;
};

export type TrackActivity = {
  id: string;
  recordId: string;
  recordName: string;
  action: string;
  detail: string;
  createdAt: number;
};

export type TrackCollection = {
  id: string;
  name: string;
  template: TrackTemplate;
  records: TrackRecord[];
  activity: TrackActivity[];
  createdAt: number;
};

const key = 'qry.track.v1';

export const templateInfo: Record<TrackTemplate, { label: string; description: string; prefix: string }> = {
  assets: { label: 'Asset checkout', description: 'Tools, keys, equipment and service state', prefix: 'AST' },
  attendance: { label: 'Attendance', description: 'Present, late and checkout records', prefix: 'ATT' },
  inventory: { label: 'Inventory', description: 'Stock quantities and item locations', prefix: 'INV' },
  maintenance: { label: 'Maintenance', description: 'Recurring service, ownership and due dates', prefix: 'MNT' },
  inspection: { label: 'Inspections', description: 'Checklists, pass/fail evidence and follow-up', prefix: 'INP' },
  visitors: { label: 'Visitor management', description: 'Guest arrival, host and checkout history', prefix: 'VST' },
  vehicles: { label: 'Vehicle checks', description: 'Fleet condition, mileage notes and service issues', prefix: 'VEH' },
  rentals: { label: 'Rental inventory', description: 'Issue, return and condition tracking', prefix: 'RNT' },
  facilities: { label: 'Facility rounds', description: 'Cleaning, safety and location checks', prefix: 'FAC' },
  deliveries: { label: 'Deliveries', description: 'Dispatch, receipt and proof notes', prefix: 'DLV' },
  training: { label: 'Training records', description: 'Certification completion and renewal dates', prefix: 'TRN' },
};

export function readTrackCollections(): TrackCollection[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function writeTrackCollections(collections: TrackCollection[]): void {
  localStorage.setItem(key, JSON.stringify(collections));
}

export function trackPayload(collectionId: string, recordId: string): string {
  return `qry://track/${encodeURIComponent(collectionId)}/${encodeURIComponent(recordId)}`;
}

export function parseTrackPayload(payload: string): { collectionId: string; recordId: string } | undefined {
  const match = payload.trim().match(/^(?:qry:\/\/track\/|https:\/\/app\.qry\.local\/track\/)([^/]+)\/([^/?#]+)$/i);
  if (!match) return undefined;
  try {
    return { collectionId: decodeURIComponent(match[1]), recordId: decodeURIComponent(match[2]) };
  } catch {
    return undefined;
  }
}

export function nextRecordCode(collection: TrackCollection): string {
  const prefix = templateInfo[collection.template].prefix;
  const used = new Set(collection.records.map((record) => record.code));
  let number = collection.records.length + 1;
  while (used.has(`${prefix}-${String(number).padStart(3, '0')}`)) number += 1;
  return `${prefix}-${String(number).padStart(3, '0')}`;
}

export type TrackAction = 'checkout' | 'return' | 'service' | 'present' | 'late' | 'leave' | 'add' | 'subtract' | 'pass' | 'fail' | 'complete' | 'reset';

export function applyTrackAction(collection: TrackCollection, recordId: string, action: TrackAction, evidence: { notes?: string; performedBy?: string; photoDataUrl?: string } = {}): { collection: TrackCollection; duplicate: boolean } {
  const record = collection.records.find((item) => item.id === recordId);
  if (!record) return { collection, duplicate: false };

  let status = record.status;
  let quantity = record.quantity;
  let label = '';
  let detail = '';

  if (action === 'checkout') { status = 'checked_out'; label = 'Checked out'; detail = 'Asset marked as checked out'; }
  if (action === 'return') { status = 'available'; label = 'Returned'; detail = 'Asset returned and available'; }
  if (action === 'service') { status = 'needs_service'; label = 'Needs service'; detail = 'Asset flagged for service'; }
  if (action === 'present') { status = 'present'; label = 'Present'; detail = 'Attendance marked present'; }
  if (action === 'late') { status = 'late'; label = 'Late'; detail = 'Attendance marked late'; }
  if (action === 'leave') { status = 'checked_out'; label = 'Checked out'; detail = 'Attendance checkout recorded'; }
  if (action === 'add') { quantity += 1; status = 'in_stock'; label = 'Stock added'; detail = `Quantity increased to ${quantity}`; }
  if (action === 'subtract') { quantity = Math.max(0, quantity - 1); status = quantity === 0 ? 'out_of_stock' : 'in_stock'; label = 'Stock removed'; detail = `Quantity reduced to ${quantity}`; }
  if (action === 'pass') { status = 'passed'; label = 'Inspection passed'; detail = evidence.notes?.trim() || 'Checklist completed without issues'; }
  if (action === 'fail') { status = 'failed'; label = 'Inspection failed'; detail = evidence.notes?.trim() || 'Follow-up is required'; }
  if (action === 'complete') { status = 'completed'; label = 'Completed'; detail = evidence.notes?.trim() || 'Scheduled work completed'; }
  if (action === 'reset') { status = 'pending'; label = 'Reopened'; detail = 'Record returned to pending'; }

  const duplicate = collection.template === 'attendance' && status === record.status;
  if (duplicate) return { collection, duplicate: true };

  const inspectionResult: TrackInspection['result'] | undefined = action === 'pass' ? 'passed' : action === 'fail' ? 'failed' : action === 'complete' ? 'completed' : undefined;
  const nextDueAt = inspectionResult && record.intervalDays
    ? Date.now() + record.intervalDays * 86_400_000
    : record.dueAt;
  const inspections: TrackInspection[] | undefined = inspectionResult ? [{
    id: makeTrackId(), result: inspectionResult, notes: evidence.notes?.trim() ?? '', performedBy: evidence.performedBy?.trim() || record.assignee || 'Device user', createdAt: Date.now(), photoDataUrl: evidence.photoDataUrl,
  }, ...(record.inspections ?? [])].slice(0, 100) : record.inspections;
  const updatedRecord = { ...record, status, quantity, dueAt: nextDueAt, inspections };
  const activity: TrackActivity = {
    id: makeTrackId(), recordId, recordName: record.name, action: label, detail, createdAt: Date.now(),
  };
  return {
    duplicate: false,
    collection: {
      ...collection,
      records: collection.records.map((item) => item.id === recordId ? updatedRecord : item),
      activity: [activity, ...collection.activity].slice(0, 500),
    },
  };
}

export function makeTrackId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function collectionCsv(collection: TrackCollection): string {
  const cells = (values: Array<string | number>) => values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',');
  return [
    cells(['Code', 'Name', 'Status', 'Quantity', 'Location', 'Assignee', 'Priority', 'Due', 'Notes', 'Created']),
    ...collection.records.map((record) => cells([
      record.code, record.name, record.status, record.quantity, record.location, record.assignee ?? '', record.priority ?? '', record.dueAt ? new Date(record.dueAt).toISOString() : '', record.notes, new Date(record.createdAt).toISOString(),
    ])),
  ].join('\r\n');
}
