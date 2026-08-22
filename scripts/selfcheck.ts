import assert from 'node:assert/strict';
import { analysePayload, contactPayloadToVcard, createPayload } from '../src/lib/qr';
import {
  applyTrackAction,
  collectionActivityCsv,
  collectionCsv,
  isTrackEvidencePhotoDataUrl,
  maxTrackActivityEvents,
  maxTrackEvidencePhotoCharacters,
  maxTrackInspectionsPerRecord,
  nextRecordCode,
  maxTrackWorkspaces,
  parseTrackPayload,
  trackPayload,
  TrackStorageError,
  updateTrackRecordDetails,
  writeTrackCollections,
  type TrackCollection,
} from '../src/track/store';
import { scrubDiagnosticText } from '../src/lib/scrub';
import { LocalStorageWriteError, maxHistoryItems, maxHistoryPayloadCharacters, upsertHistoryItem, writeHistory, writePreferences, type SavedItem } from '../src/lib/storage';
import { LocalOnlySyncAdapter, type SyncEnvelope } from '../src/sync/types';
import { applyImportedRecords, buildImportPreview, limitImportedRecords, mergeBackup, parseBackup, parseCsv, suggestMapping } from '../src/track/import';
import { generateLabelPdf } from '../src/track/labels';
import { BusinessStorageError, businessBackupJson, campaignPayload, campaignScanCount, deriveAlerts, maxBusinessCampaigns, maxBusinessMembers, operationsSummary, parseBusinessBackup, parseCampaignPayload, portfolioCsv, recordCampaignScan, recordNeedsAttention, writeBusinessState, type BusinessState } from '../src/business/store';
import { generateOperationsReportPdf } from '../src/business/reports';
import { campaignDraftMatchesSaved } from '../src/business/campaign-integrity';
import { resolveCloudAccountAvailability, resolveDefaultCloudApiBase } from '../src/cloud/config';
import { initializeBilling, purchasePlan, restoreBilling } from '../src/lib/billing';
import { lastItem } from '../src/lib/collections';
import { neutralizeSpreadsheetFormula, quoteCsvCell } from '../src/lib/csv';
import { assertPdfTextSupported, pdfSafeText } from '../src/lib/pdf-text';
import { mobileBannerFallbackMargin, resolveMobileBannerMargin } from '../src/lib/ad-layout';

function withFailingLocalStorage(run: () => void): void {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => null,
      setItem: () => { throw new Error('quota'); },
      removeItem: () => { throw new Error('quota'); },
    },
  });
  try { run(); } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
}

assert.equal(lastItem(['older-dialog', 'newer-dialog']), 'newer-dialog');
assert.equal(lastItem([]), undefined);
assert.equal(resolveMobileBannerMargin(800, 696, 0), 116);
assert.equal(resolveMobileBannerMargin(800, 678, 0), 134);
assert.equal(resolveMobileBannerMargin(800, 672, 24), 116);
assert.equal(resolveMobileBannerMargin(800, undefined, 0), mobileBannerFallbackMargin);
for (const prefix of ['=', '+', '-', '@', ' =', '\t@']) assert.equal(neutralizeSpreadsheetFormula(`${prefix}SUM(A1:A2)`).startsWith("'"), true);
assert.equal(quoteCsvCell(-12), '"-12"');
assert.equal(pdfSafeText('Crème — مضخة').includes('—'), false);
assert.match(pdfSafeText('Crème — مضخة'), /^[\x20-\x7E]+$/);
assert.throws(() => assertPdfTextSupported(['مضخة']));

const secureLink = analysePayload('https://example.com/menu');
assert.equal(secureLink.kind, 'link');
assert.equal(secureLink.risk, 'clear');
assert.equal(secureLink.host, 'example.com');

assert.equal(resolveCloudAccountAvailability(undefined, false), false);
assert.equal(resolveCloudAccountAvailability('   ', false), false);
assert.equal(resolveCloudAccountAvailability(undefined, true), true);
assert.equal(resolveCloudAccountAvailability('https://cloud.example.com', false), true);
assert.equal(resolveDefaultCloudApiBase(undefined, false), '');
assert.equal(resolveDefaultCloudApiBase(undefined, true), 'http://127.0.0.1:8787');
assert.equal(resolveDefaultCloudApiBase(' https://cloud.example.com ', false), 'https://cloud.example.com');

for (const billingResult of await Promise.all([initializeBilling(), purchasePlan('deferred-plan'), restoreBilling()])) {
  assert.deepEqual(billingResult, { status: 'unconfigured', pro: false, plans: [] });
}

const insecureLink = analysePayload('http://192.168.1.2/login');
assert.equal(insecureLink.kind, 'link');
assert.equal(insecureLink.risk, 'caution');
assert.ok(insecureLink.riskReasons.length >= 2);

const deceptiveLink = analysePayload('https://user:secret@example.com/verify-account');
assert.equal(deceptiveLink.risk, 'danger');
const credentialIpLink = analysePayload('https://user:secret@127.0.0.1/private');
assert.equal(credentialIpLink.kind, 'link');
assert.equal(credentialIpLink.risk, 'danger');
assert.equal(credentialIpLink.actionLabel, 'Open anyway');
const localLink = analysePayload(createPayload('link', { url: 'http://localhost:8787/status' }));
assert.equal(localLink.kind, 'link');
assert.equal(localLink.risk, 'caution');
assert.equal(localLink.host, 'localhost');

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
assert.equal(createPayload('wifi', { ssid: '', security: 'WPA' }), '');

const contact = createPayload('contact', {
  name: 'Amina Shah',
  phone: '+92 300 1234567',
  email: 'amina@example.com',
});
assert.match(contact, /^BEGIN:VCARD/);
assert.match(contact, /FN:Amina Shah/);
assert.equal(createPayload('contact', {}), '');
assert.match(createPayload('contact', { name: 'Doe, A; B\\C' }), /FN:Doe\\, A\\; B\\\\C\r\n/);
const analysedContact = analysePayload(contact);
assert.equal(analysedContact.kind, 'contact');
assert.equal(analysedContact.actionHref, undefined);
assert.match(contactPayloadToVcard('MECARD:N:Doe,Jane;TEL:+1 555;EMAIL:jane@example.com;;'), /FN:Doe Jane\r\nTEL:\+1 555\r\nEMAIL:jane@example.com/);
assert.equal(analysePayload(createdWifi).actionHref, undefined);
assert.equal(createPayload('link', { url: 'https://%' }), '');

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
assert.equal(nextRecordCode({ ...collection, records: [{ ...collection.records[0], code: 'ast-002' }] }), 'AST-003');
const checkout = applyTrackAction(collection, 'drill', 'checkout');
assert.equal(checkout.collection.records[0].status, 'checked_out');
assert.equal(checkout.collection.activity[0].action, 'Checked out');
assert.match(collectionCsv(checkout.collection), /"AST-001","Cordless drill","checked_out"/);
assert.match(collectionActivityCsv(checkout.collection), /"AST-001","Cordless drill","Checked out","Asset marked as checked out"/);
const editedCheckout = updateTrackRecordDetails(checkout.collection, 'drill', {
  name: 'Updated drill', quantity: 1, location: 'Shelf B', notes: 'Calibrated', assignee: 'Amina', dueAt: 86_400_000,
  intervalDays: 30, priority: 'high', checklist: ['Inspect chuck'], contact: 'amina@example.com', reference: 'TOOL-9',
});
assert.equal(editedCheckout.records[0].id, 'drill');
assert.equal(editedCheckout.records[0].code, 'AST-001');
assert.equal(editedCheckout.records[0].status, 'checked_out');
assert.equal(editedCheckout.records[0].name, 'Updated drill');
assert.equal(editedCheckout.records[0].reference, 'TOOL-9');
assert.deepEqual(editedCheckout.activity, checkout.collection.activity);
const inventoryEdit = updateTrackRecordDetails({
  ...collection,
  template: 'inventory',
  records: [{ ...collection.records[0], code: 'INV-001', status: 'in_stock' }],
}, 'drill', {
  ...collection.records[0],
  quantity: 0,
});
assert.equal(inventoryEdit.records[0].status, 'out_of_stock');
const restockedInventoryEdit = updateTrackRecordDetails(inventoryEdit, 'drill', {
  ...inventoryEdit.records[0],
  quantity: 2,
});
assert.equal(restockedInventoryEdit.records[0].status, 'in_stock');

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
const editedMaintenance = updateTrackRecordDetails(completedMaintenance, 'pump', {
  ...completedMaintenance.records[0],
  notes: 'Updated notes',
});
assert.deepEqual(editedMaintenance.records[0].inspections, completedMaintenance.records[0].inspections);
const oneOffMaintenance = { ...maintenance, records: [{ ...maintenance.records[0], intervalDays: undefined }] };
assert.equal(applyTrackAction(oneOffMaintenance, 'pump', 'complete').collection.records[0].dueAt, undefined);
const oneOffInspection = { ...oneOffMaintenance, template: 'inspection' as const };
assert.equal(applyTrackAction(oneOffInspection, 'pump', 'pass').collection.records[0].dueAt, undefined);
assert.equal(applyTrackAction(oneOffInspection, 'pump', 'fail').collection.records[0].dueAt, maintenance.records[0].dueAt);
assert.equal(maxTrackActivityEvents, 500);
assert.equal(maxTrackInspectionsPerRecord, 100);
const retentionActivity = Array.from({ length: maxTrackActivityEvents }, (_, index) => ({ id: `event-${index}`, recordId: 'drill', recordName: 'Cordless drill', action: 'Existing', detail: '', createdAt: index + 1 }));
const activityCapped = applyTrackAction({ ...collection, activity: retentionActivity }, 'drill', 'checkout').collection;
assert.equal(activityCapped.activity.length, maxTrackActivityEvents);
assert.equal(activityCapped.activity[0].action, 'Checked out');
const retentionInspections = Array.from({ length: maxTrackInspectionsPerRecord }, (_, index) => ({ id: `inspection-${index}`, result: 'completed' as const, notes: '', performedBy: 'Tester', createdAt: index + 1 }));
const inspectionCapped = applyTrackAction({ ...maintenance, records: [{ ...maintenance.records[0], inspections: retentionInspections }] }, 'pump', 'complete').collection;
assert.equal(inspectionCapped.records[0].inspections?.length, maxTrackInspectionsPerRecord);
assert.equal(inspectionCapped.records[0].inspections?.[0].notes, '');

withFailingLocalStorage(() => assert.throws(() => writeTrackCollections([collection]), TrackStorageError));
assert.throws(() => writeTrackCollections(Array.from({ length: maxTrackWorkspaces + 1 }, (_, index) => ({ ...collection, id: String(index) }))), TrackStorageError);
const oversizedEvidence = structuredClone(maintenance);
oversizedEvidence.records[0].inspections = [{ id: 'large', result: 'completed', notes: '', performedBy: 'Tester', createdAt: 1, photoDataUrl: `data:image/jpeg;base64,${'A'.repeat(3 * 1024 * 1024)}` }];
assert.throws(() => writeTrackCollections([oversizedEvidence]), TrackStorageError);
const evidenceOverReadLimit = structuredClone(maintenance);
evidenceOverReadLimit.records[0].inspections = [{ id: 'read-limit', result: 'completed', notes: '', performedBy: 'Tester', createdAt: 1, photoDataUrl: `data:image/jpeg;base64,${'A'.repeat(maxTrackEvidencePhotoCharacters)}` }];
assert.equal(isTrackEvidencePhotoDataUrl(evidenceOverReadLimit.records[0].inspections[0].photoDataUrl), false);
assert.throws(() => writeTrackCollections([evidenceOverReadLimit]), { name: 'TrackStorageError', message: /evidence photo is too large or invalid/ });

const business: BusinessState = {
  members: [],
  automations: [{ id: 'low_stock', enabled: true, threshold: 3 }, { id: 'due_soon', enabled: true, threshold: 7 }, { id: 'needs_service', enabled: true, threshold: 0 }, { id: 'failed_inspection', enabled: true, threshold: 0 }],
  campaigns: [{ id: 'menu', name: 'Menu', destination: 'https://example.com/menu', slug: 'menu', color: '#173f35', active: true, scans: [], createdAt: 1 }],
  integrations: { webhookUrl: '', syncEndpoint: '', customDomain: '' },
};
assert.equal(campaignDraftMatchesSaved(business.campaigns[0], { name: 'Menu', destination: 'example.com/menu', slug: 'menu', color: '#173f35' }), true);
assert.equal(campaignDraftMatchesSaved(business.campaigns[0], { name: 'Menu', destination: 'example.com/menu', slug: 'unsaved-menu', color: '#173f35' }), false);
assert.equal(campaignDraftMatchesSaved(undefined, { name: 'Menu', destination: 'example.com/menu', slug: 'menu', color: '#173f35' }), false);
assert.equal(parseCampaignPayload(campaignPayload('menu')), 'menu');
assert.equal(parseCampaignPayload('https://app.qry.local/go/menu'), 'menu');
assert.equal(recordCampaignScan(business, 'menu', 'camera').campaigns[0].scans.length, 1);
let scanCappedBusiness = business;
for (let index = 0; index < 300; index += 1) scanCappedBusiness = recordCampaignScan(scanCappedBusiness, 'menu', 'preview');
assert.equal(scanCappedBusiness.campaigns[0].scans.length, 250);
assert.equal(campaignScanCount(scanCappedBusiness.campaigns[0]), 300);
const restoredBusiness = parseBusinessBackup(businessBackupJson(scanCappedBusiness));
assert.equal(restoredBusiness.campaigns[0].id, 'menu');
assert.equal(campaignScanCount(restoredBusiness.campaigns[0]), 300);
assert.throws(() => parseBusinessBackup(JSON.stringify({ schemaVersion: 1, kind: 'qryverse-business-backup', business: { ...business, campaigns: [{ ...business.campaigns[0], destination: 'https://%' }] } })));
assert.throws(() => parseBusinessBackup(JSON.stringify({ schemaVersion: 1, kind: 'qryverse-business-backup', business: { ...business, members: [{ id: 'same', name: 'A', role: 'viewer' }, { id: 'same', name: 'B', role: 'viewer' }] } })));
const savedItem: SavedItem = { id: 'saved', payload: 'hello', title: 'hello', kind: 'text', risk: 'clear', createdAt: 1, source: 'created', favourite: false };
const refreshedItem = upsertHistoryItem([{ ...savedItem, favourite: true }], { ...savedItem, id: 'replacement', source: 'scan', favourite: false, createdAt: 2 });
assert.equal(refreshedItem[0].id, 'saved');
assert.equal(refreshedItem[0].favourite, true);
assert.equal(refreshedItem[0].source, 'created');
withFailingLocalStorage(() => {
  assert.throws(() => writeHistory([savedItem]), LocalStorageWriteError);
  assert.throws(() => writePreferences({ autoSave: true, haptics: true, theme: 'system' }), LocalStorageWriteError);
  assert.throws(() => writeBusinessState(business), BusinessStorageError);
});
assert.throws(() => writeHistory([{ ...savedItem, payload: 'A'.repeat(600 * 1024) }]), LocalStorageWriteError);
assert.throws(() => writeHistory([{ ...savedItem, payload: 'A'.repeat(maxHistoryPayloadCharacters + 1) }]), LocalStorageWriteError);
assert.throws(() => writeHistory(Array.from({ length: maxHistoryItems + 1 }, (_, index) => ({ ...savedItem, id: String(index) }))), LocalStorageWriteError);
assert.throws(() => writeBusinessState({ ...business, integrations: { ...business.integrations, customDomain: 'A'.repeat(600 * 1024) } }), BusinessStorageError);
assert.throws(() => writeBusinessState({ ...business, members: Array.from({ length: maxBusinessMembers + 1 }, (_, index) => ({ id: String(index), name: `Member ${index}`, email: '', role: 'viewer', active: true, createdAt: 1 })) }), BusinessStorageError);
assert.throws(() => writeBusinessState({ ...business, campaigns: Array.from({ length: maxBusinessCampaigns + 1 }, (_, index) => ({ ...business.campaigns[0], id: String(index) })) }), BusinessStorageError);
assert.equal(deriveAlerts([maintenance], business).some((alert) => alert.title.includes('overdue')), true);
assert.equal(operationsSummary([collection, maintenance]).records, 2);
assert.match(portfolioCsv([maintenance]), /"Maintenance","maintenance","MNT-001"/);
assert.match(collectionCsv({ ...collection, records: [{ ...collection.records[0], name: '=HYPERLINK("https://bad")' }] }), /"'=HYPERLINK\(""https:\/\/bad""\)"/);
assert.match(portfolioCsv([{ ...maintenance, name: ' @SUM(A1:A2)' }]), /"' @SUM\(A1:A2\)"/);
assert.equal(recordNeedsAttention('attendance', { ...collection.records[0], status: 'checked_out' }), false);
assert.equal(recordNeedsAttention('assets', { ...collection.records[0], status: 'checked_out' }), true);
const reportPdf = await generateOperationsReportPdf([collection, maintenance]);
assert.equal(new TextDecoder().decode(reportPdf.slice(0, 4)), '%PDF');

const scrubbed = scrubDiagnosticText('Failed at https://example.com/a for user@example.com and +92 300 1234567');
assert.equal(scrubbed.includes('example.com'), false);
assert.equal(scrubbed.includes('user@example.com'), false);
assert.equal(scrubbed.includes('1234567'), false);

const envelope: SyncEnvelope = { schemaVersion: 1, deviceId: 'test-device', updatedAt: 1, collections: [collection], business };
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
const duplicateCsv = parseCsv('Code,Name\r\nAST-001,First\r\nAST-001,Last');
const replacementPreview = buildImportPreview(collection, duplicateCsv, { code: 0, name: 1 }, 'replace');
assert.equal(replacementPreview.records.length, 1);
assert.equal(replacementPreview.records[0].name, 'Last');
assert.equal(applyImportedRecords(collection, replacementPreview).records.filter((record) => record.id === 'drill').length, 1);
const inventoryCollection: TrackCollection = { ...collection, template: 'inventory', records: [{ ...collection.records[0], code: 'INV-001', status: 'in_stock', quantity: 4 }] };
const inventoryReplacement = buildImportPreview(inventoryCollection, parseCsv('Code,Name,Quantity\r\nINV-001,Drill,0'), { code: 0, name: 1, quantity: 2 }, 'replace');
assert.equal(inventoryReplacement.records[0].quantity, 0);
assert.equal(inventoryReplacement.records[0].status, 'out_of_stock');
const fullCollection = { ...collection, records: Array.from({ length: 1000 }, (_, index) => ({ ...collection.records[0], id: `record-${index}`, code: `AST-${index}` })) };
const fullReplacement = buildImportPreview(fullCollection, parseCsv('Code,Name\r\nAST-0,Updated\r\nNEW-1,New'), { code: 0, name: 1 }, 'replace');
const acceptedAtCapacity = limitImportedRecords(fullCollection, fullReplacement.records, 1000);
assert.equal(acceptedAtCapacity.length, 1);
assert.equal(acceptedAtCapacity[0].name, 'Updated');

const parsedBackup = parseBackup(JSON.stringify(collection));
assert.equal(parsedBackup.recordCount, 1);
const mergedBackup = mergeBackup([{ ...collection, name: 'Old name' }], parsedBackup.collections);
assert.equal(mergedBackup[0].name, 'Workshop assets');
assert.throws(() => parseBackup(JSON.stringify({ ...collection, records: Array.from({ length: 1001 }, (_, index) => ({ ...collection.records[0], id: String(index) })) })));
assert.throws(() => parseBackup(JSON.stringify([{ ...collection }, { ...collection, name: 'Duplicate workspace' }])));
assert.throws(() => parseBackup(JSON.stringify({ ...collection, records: [collection.records[0], { ...collection.records[0], name: 'Duplicate record' }] })));
const timestampBoundBackup = parseBackup(JSON.stringify({ ...collection, records: [{ ...collection.records[0], createdAt: 1e20 }] }));
assert.equal(timestampBoundBackup.collections[0].records[0].createdAt <= Date.now() + 100 * 365.25 * 86_400_000, true);
assert.throws(() => mergeBackup(
  [{ ...collection, records: Array.from({ length: 1000 }, (_, index) => ({ ...collection.records[0], id: `local-${index}`, code: `L-${index}` })) }],
  [{ ...collection, records: [{ ...collection.records[0], id: 'incoming-only', code: 'I-1' }] }],
));

const labelPdf = await generateLabelPdf(collection, { pageFormat: 'a4', template: 'standard' });
assert.equal(new TextDecoder().decode(labelPdf.slice(0, 4)), '%PDF');

console.log('QRY self-check passed: QR routing, safety, campaigns, workflows, alerts, inspections, imports, labels, reports, and sync boundaries.');
