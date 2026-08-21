import assert from 'node:assert/strict';
import { analysePayload, createPayload } from '../src/lib/qr';
import {
  applyTrackAction,
  collectionCsv,
  nextRecordCode,
  parseTrackPayload,
  trackPayload,
  type TrackCollection,
} from '../src/track/store';
import { scrubDiagnosticText } from '../src/lib/scrub';
import { LocalOnlySyncAdapter, type SyncEnvelope } from '../src/sync/types';
import { buildImportPreview, mergeBackup, parseBackup, parseCsv, suggestMapping } from '../src/track/import';
import { generateLabelPdf } from '../src/track/labels';
import { campaignPayload, deriveAlerts, operationsSummary, parseCampaignPayload, portfolioCsv, recordCampaignScan, type BusinessState } from '../src/business/store';
import { generateOperationsReportPdf } from '../src/business/reports';

const secureLink = analysePayload('https://example.com/menu');
assert.equal(secureLink.kind, 'link');
assert.equal(secureLink.risk, 'clear');
assert.equal(secureLink.host, 'example.com');

const insecureLink = analysePayload('http://192.168.1.2/login');
assert.equal(insecureLink.kind, 'link');
assert.equal(insecureLink.risk, 'caution');
assert.ok(insecureLink.riskReasons.length >= 2);

const deceptiveLink = analysePayload('https://user:secret@example.com/verify-account');
assert.equal(deceptiveLink.risk, 'danger');

const wifi = analysePayload('WIFI:T:WPA;S:Studio;P:secret;;');
assert.equal(wifi.kind, 'wifi');
assert.equal(wifi.title, 'Studio');

const createdWifi = createPayload('wifi', {
  ssid: 'Cafe;Guest',
  password: 'hello:world',
  security: 'WPA',
  hidden: 'false',
});
assert.equal(createdWifi, 'WIFI:T:WPA;S:Cafe\\;Guest;P:hello\\:world;H:false;;');

const contact = createPayload('contact', {
  name: 'Amina Shah',
  phone: '+92 300 1234567',
  email: 'amina@example.com',
});
assert.match(contact, /^BEGIN:VCARD/);
assert.match(contact, /FN:Amina Shah/);

const collection: TrackCollection = {
  id: 'workshop',
  name: 'Workshop assets',
  template: 'assets',
  createdAt: 1,
  activity: [],
  records: [{ id: 'drill', code: 'AST-001', name: 'Cordless drill', status: 'available', quantity: 1, location: 'Shelf A', notes: '', createdAt: 1 }],
};
assert.deepEqual(parseTrackPayload(trackPayload('workshop', 'drill')), { collectionId: 'workshop', recordId: 'drill' });
assert.deepEqual(parseTrackPayload('https://app.qry.local/track/workshop/drill'), { collectionId: 'workshop', recordId: 'drill' });
assert.equal(nextRecordCode(collection), 'AST-002');
const checkout = applyTrackAction(collection, 'drill', 'checkout');
assert.equal(checkout.collection.records[0].status, 'checked_out');
assert.equal(checkout.collection.activity[0].action, 'Checked out');
assert.match(collectionCsv(checkout.collection), /"AST-001","Cordless drill","checked_out"/);

const attendance: TrackCollection = {
  ...collection,
  template: 'attendance',
  records: [{ ...collection.records[0], status: 'present' }],
};
assert.equal(applyTrackAction(attendance, 'drill', 'present').duplicate, true);

const maintenance: TrackCollection = {
  id: 'maintenance', name: 'Maintenance', template: 'maintenance', createdAt: 1, activity: [],
  records: [{ ...collection.records[0], id: 'pump', code: 'MNT-001', name: 'Water pump', status: 'pending', dueAt: Date.now() - 86_400_000, intervalDays: 30, checklist: ['Check seals', 'Measure pressure'], inspections: [] }],
};
const completedMaintenance = applyTrackAction(maintenance, 'pump', 'complete', { notes: 'Pressure normal', performedBy: 'Amina' }).collection;
assert.equal(completedMaintenance.records[0].status, 'completed');
assert.equal(completedMaintenance.records[0].inspections?.[0].result, 'completed');
assert.equal(completedMaintenance.records[0].inspections?.[0].performedBy, 'Amina');
assert.ok((completedMaintenance.records[0].dueAt ?? 0) > Date.now());

const business: BusinessState = {
  members: [],
  automations: [{ id: 'low_stock', enabled: true, threshold: 3 }, { id: 'due_soon', enabled: true, threshold: 7 }, { id: 'needs_service', enabled: true, threshold: 0 }, { id: 'failed_inspection', enabled: true, threshold: 0 }],
  campaigns: [{ id: 'menu', name: 'Menu', destination: 'https://example.com/menu', slug: 'menu', color: '#173f35', active: true, scans: [], createdAt: 1 }],
  integrations: { webhookUrl: '', syncEndpoint: '', customDomain: '' },
};
assert.equal(parseCampaignPayload(campaignPayload('menu')), 'menu');
assert.equal(parseCampaignPayload('https://app.qry.local/go/menu'), 'menu');
assert.equal(recordCampaignScan(business, 'menu', 'camera').campaigns[0].scans.length, 1);
assert.equal(deriveAlerts([maintenance], business).some((alert) => alert.title.includes('overdue')), true);
assert.equal(operationsSummary([collection, maintenance]).records, 2);
assert.match(portfolioCsv([maintenance]), /"Maintenance","maintenance","MNT-001"/);
const reportPdf = await generateOperationsReportPdf([collection, maintenance]);
assert.equal(new TextDecoder().decode(reportPdf.slice(0, 4)), '%PDF');

const scrubbed = scrubDiagnosticText('Failed at https://example.com/a for user@example.com and +92 300 1234567');
assert.equal(scrubbed.includes('example.com'), false);
assert.equal(scrubbed.includes('user@example.com'), false);
assert.equal(scrubbed.includes('1234567'), false);

const envelope: SyncEnvelope = { schemaVersion: 1, deviceId: 'test-device', updatedAt: 1, collections: [collection] };
const syncResult = await new LocalOnlySyncAdapter().push(envelope);
assert.equal(syncResult.status, 'local-only');
assert.equal(syncResult.envelope, envelope);

const csv = parseCsv('Asset ID,Item Name,Location,Qty,Notes\r\nD-1,"Drill, cordless",Shelf A,3,"Shared\ntool"');
assert.equal(csv.rows[0][1], 'Drill, cordless');
assert.equal(csv.rows[0][4], 'Shared\ntool');
const mapping = suggestMapping(csv.headers);
assert.deepEqual(mapping, { name: 1, code: 0, location: 2, quantity: 3, notes: 4 });
const importPreview = buildImportPreview({ ...collection, records: [] }, csv, mapping, 'skip');
assert.equal(importPreview.records[0].quantity, 3);
assert.equal(importPreview.records[0].code, 'D-1');

const parsedBackup = parseBackup(JSON.stringify(collection));
assert.equal(parsedBackup.recordCount, 1);
const mergedBackup = mergeBackup([{ ...collection, name: 'Old name' }], parsedBackup.collections);
assert.equal(mergedBackup[0].name, 'Workshop assets');

const labelPdf = await generateLabelPdf(collection, { pageFormat: 'a4', template: 'standard' });
assert.equal(new TextDecoder().decode(labelPdf.slice(0, 4)), '%PDF');

console.log('QRY self-check passed: QR routing, safety, campaigns, workflows, alerts, inspections, imports, labels, reports, and sync boundaries.');
