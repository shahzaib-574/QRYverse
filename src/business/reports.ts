import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { TrackCollection } from '../track/store';
import { operationsSummary } from './store';

export async function generateOperationsReportPdf(collections: TrackCollection[]): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle('QRY Operations Report');
  document.setAuthor('QRY Track');
  document.setSubject('Local operations summary');
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const summary = operationsSummary(collections);
  let page = addPage(document, bold, regular, summary);
  let y = 595;
  for (const collection of collections) {
    if (y < 95) { page = addPage(document, bold, regular, summary, false); y = 720; }
    const attention = collection.records.filter((record) => ['failed', 'needs_service', 'out_of_stock', 'checked_out'].includes(record.status) || Boolean(record.dueAt && record.dueAt < Date.now())).length;
    page.drawText(fit(collection.name, bold, 12, 350), { x: 48, y, size: 12, font: bold, color: rgb(.09, .24, .20) });
    page.drawText(collection.template.replaceAll('_', ' ').toUpperCase(), { x: 410, y: y + 1, size: 7, font: bold, color: rgb(.82, .37, .18) });
    y -= 18;
    page.drawText(`${collection.records.length} records  |  ${attention} attention  |  ${collection.activity.length} activity events`, { x: 48, y, size: 8, font: regular, color: rgb(.39, .46, .42) });
    y -= 17;
    for (const record of collection.records.slice(0, 12)) {
      if (y < 72) break;
      page.drawText(fit(`${record.code}  ${record.name}`, regular, 8, 335), { x: 58, y, size: 8, font: regular, color: rgb(.18, .25, .22) });
      page.drawText(fit(record.status.replaceAll('_', ' '), regular, 8, 110), { x: 410, y, size: 8, font: regular, color: statusColor(record.status) });
      y -= 14;
    }
    if (collection.records.length > 12) { page.drawText(`+ ${collection.records.length - 12} more records in CSV export`, { x: 58, y, size: 7, font: regular, color: rgb(.45, .51, .48) }); y -= 14; }
    y -= 14;
  }
  for (const [index, item] of document.getPages().entries()) item.drawText(`QRY Track  |  Generated ${new Date().toLocaleDateString()}  |  Page ${index + 1}`, { x: 48, y: 30, size: 7, font: regular, color: rgb(.48, .53, .50) });
  return document.save();
}

function addPage(document: PDFDocument, bold: PDFFont, regular: PDFFont, summary: ReturnType<typeof operationsSummary>, hero = true): PDFPage {
  const page = document.addPage([595.28, 841.89]);
  page.drawRectangle({ x: 0, y: 0, width: 595.28, height: 841.89, color: rgb(.985, .98, .95) });
  page.drawText('QRY', { x: 48, y: 792, size: 17, font: bold, color: rgb(.09, .24, .20) });
  page.drawText('OPERATIONS REPORT', { x: 101, y: 796, size: 7, font: bold, color: rgb(.82, .37, .18) });
  if (hero) {
    page.drawText('Your operations, clearly.', { x: 48, y: 744, size: 25, font: bold, color: rgb(.09, .24, .20) });
    page.drawText('A device-local summary of workspaces, records, inspections, and attention items.', { x: 48, y: 722, size: 9, font: regular, color: rgb(.39, .46, .42) });
    const values = [[summary.workspaces, 'WORKSPACES'], [summary.records, 'RECORDS'], [summary.attention, 'ATTENTION'], [summary.inspections, 'INSPECTIONS']] as const;
    values.forEach(([value, label], index) => {
      const x = 48 + index * 126;
      page.drawRectangle({ x, y: 642, width: 112, height: 58, color: index === 2 && value ? rgb(.96, .87, .83) : rgb(.89, .93, .90), borderColor: rgb(.82, .86, .83), borderWidth: .5 });
      page.drawText(String(value), { x: x + 12, y: 670, size: 16, font: bold, color: rgb(.09, .24, .20) });
      page.drawText(label, { x: x + 12, y: 654, size: 6, font: bold, color: rgb(.42, .49, .45) });
    });
  }
  return page;
}

function fit(value: string, font: PDFFont, size: number, width: number): string {
  let result = value;
  while (result.length > 2 && font.widthOfTextAtSize(`${result}...`, size) > width) result = result.slice(0, -1);
  return result === value ? value : `${result}...`;
}

function statusColor(status: string) {
  return ['failed', 'needs_service', 'out_of_stock'].includes(status) ? rgb(.67, .25, .18) : rgb(.22, .45, .36);
}
