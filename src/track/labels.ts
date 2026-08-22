import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';
import { assertPdfTextSupported, pdfSafeText } from '../lib/pdf-text';
import { maxLabelsPerPdf } from './limits';
import { trackPayload, type TrackCollection, type TrackRecord } from './store';

export type PageFormat = 'a4' | 'letter';
export type LabelTemplate = 'compact' | 'standard' | 'large';

export type LabelPdfOptions = {
  pageFormat: PageFormat;
  template: LabelTemplate;
  recordIds?: string[];
};

const pageSizes: Record<PageFormat, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

const grids: Record<LabelTemplate, { columns: number; rows: number }> = {
  compact: { columns: 3, rows: 8 },
  standard: { columns: 2, rows: 5 },
  large: { columns: 2, rows: 3 },
};

export async function generateLabelPdf(collection: TrackCollection, options: LabelPdfOptions): Promise<Uint8Array> {
  const selected = options.recordIds?.length
    ? collection.records.filter((record) => options.recordIds?.includes(record.id))
    : collection.records;
  if (selected.length === 0) throw new Error('Choose at least one record for the label sheet.');
  if (selected.length > maxLabelsPerPdf) throw new Error(`Create labels in batches of up to ${maxLabelsPerPdf}.`);
  assertPdfTextSupported([collection.name, ...selected.flatMap((record) => [record.name, record.code, record.location])]);

  const document = await PDFDocument.create();
  document.setTitle(`${collection.name} - QRY Track labels`);
  document.setAuthor('QRY Track');
  document.setSubject('Printable QR operations labels');
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const [pageWidth, pageHeight] = pageSizes[options.pageFormat];
  const grid = grids[options.template];
  const margin = 24;
  const gap = 7;
  const labelWidth = (pageWidth - margin * 2 - gap * (grid.columns - 1)) / grid.columns;
  const labelHeight = (pageHeight - margin * 2 - gap * (grid.rows - 1)) / grid.rows;
  const perPage = grid.columns * grid.rows;

  for (let offset = 0; offset < selected.length; offset += perPage) {
    const page = document.addPage([pageWidth, pageHeight]);
    const batch = selected.slice(offset, offset + perPage);
    for (let index = 0; index < batch.length; index += 1) {
      const column = index % grid.columns;
      const row = Math.floor(index / grid.columns);
      const x = margin + column * (labelWidth + gap);
      const y = pageHeight - margin - (row + 1) * labelHeight - row * gap;
      await drawLabel(document, page, collection, batch[index], x, y, labelWidth, labelHeight, regular, bold, options.template);
    }
    page.drawText(pdfSafeText(`QRY Track  |  ${collection.name}  |  Page ${Math.floor(offset / perPage) + 1}`), {
      x: margin, y: 8, size: 6.5, font: regular, color: rgb(0.42, 0.49, 0.45),
    });
  }
  return document.save();
}

async function drawLabel(
  document: PDFDocument,
  page: PDFPage,
  collection: TrackCollection,
  record: TrackRecord,
  x: number,
  y: number,
  width: number,
  height: number,
  regular: PDFFont,
  bold: PDFFont,
  template: LabelTemplate,
) {
  page.drawRectangle({ x, y, width, height, borderWidth: 0.65, borderColor: rgb(0.77, 0.82, 0.78), color: rgb(1, 0.998, 0.975) });
  const padding = template === 'compact' ? 7 : 10;
  const qrSize = Math.min(height - padding * 2, template === 'compact' ? 62 : template === 'standard' ? 88 : 112);
  const dataUrl = await QRCode.toDataURL(trackPayload(collection.id, record.id), { width: 360, margin: 2, errorCorrectionLevel: 'H', color: { dark: '#173f35', light: '#fffdf7' } });
  const png = await document.embedPng(dataUrl);
  page.drawImage(png, { x: x + padding, y: y + (height - qrSize) / 2, width: qrSize, height: qrSize });

  const textX = x + padding + qrSize + (template === 'compact' ? 6 : 10);
  const textWidth = width - (textX - x) - padding;
  const nameSize = template === 'compact' ? 8.5 : template === 'standard' ? 12 : 15;
  const codeSize = template === 'compact' ? 6.5 : 8;
  const centerY = y + height / 2;
  page.drawText(fitText(pdfSafeText(record.name), bold, nameSize, textWidth), { x: textX, y: centerY + nameSize * 0.35, size: nameSize, font: bold, color: rgb(0.09, 0.25, 0.21) });
  page.drawText(fitText(pdfSafeText(record.code), regular, codeSize, textWidth), { x: textX, y: centerY - codeSize * 1.05, size: codeSize, font: regular, color: rgb(0.39, 0.46, 0.42) });
  if (record.location && height >= 90) page.drawText(fitText(pdfSafeText(record.location), regular, codeSize, textWidth), { x: textX, y: centerY - codeSize * 2.45, size: codeSize, font: regular, color: rgb(0.39, 0.46, 0.42) });
  page.drawText('SCAN WITH QRY', { x: textX, y: y + padding, size: template === 'compact' ? 5.2 : 6.3, font: bold, color: rgb(0.91, 0.47, 0.26) });
}

function fitText(value: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  let shortened = value;
  while (shortened.length > 1 && font.widthOfTextAtSize(`${shortened}...`, size) > maxWidth) shortened = shortened.slice(0, -1);
  return `${shortened}...`;
}
