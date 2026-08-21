import { mkdir, writeFile } from 'node:fs/promises';
import { generateOperationsReportPdf } from '../src/business/reports';
import type { TrackCollection } from '../src/track/store';

const now = Date.now();
const collections: TrackCollection[] = [{
  id: 'maintenance', name: 'Facilities Maintenance', template: 'maintenance', createdAt: now, activity: [], records: [
    { id: 'pump', code: 'MNT-001', name: 'Main water pump', status: 'completed', quantity: 1, location: 'Basement', notes: '', assignee: 'Facilities Team', dueAt: now + 20 * 86_400_000, intervalDays: 30, priority: 'high', checklist: ['Check seals', 'Measure pressure'], inspections: [{ id: 'inspection-1', result: 'completed', notes: 'Pressure normal', performedBy: 'Amina', createdAt: now }], createdAt: now },
    { id: 'exit', code: 'MNT-002', name: 'Emergency exit lighting', status: 'needs_service', quantity: 1, location: 'Floor 2', notes: 'Battery replacement required', assignee: 'Electrical Team', dueAt: now - 2 * 86_400_000, priority: 'high', createdAt: now },
  ],
}, {
  id: 'inventory', name: 'Main Storeroom', template: 'inventory', createdAt: now, activity: [], records: [
    { id: 'gloves', code: 'INV-001', name: 'Safety gloves', status: 'in_stock', quantity: 18, location: 'Shelf C', notes: '', createdAt: now },
    { id: 'filters', code: 'INV-002', name: 'Air filters', status: 'out_of_stock', quantity: 0, location: 'Shelf B', notes: '', createdAt: now },
  ],
}];

await mkdir('output/pdf', { recursive: true });
await writeFile('output/pdf/qry-operations-report-sample.pdf', await generateOperationsReportPdf(collections));
console.log('Created output/pdf/qry-operations-report-sample.pdf');
