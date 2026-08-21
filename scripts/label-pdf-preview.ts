import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { generateLabelPdf } from '../src/track/labels';
import type { TrackCollection } from '../src/track/store';

const collection: TrackCollection = {
  id: 'sample-workshop',
  name: 'Workshop Assets',
  template: 'assets',
  createdAt: Date.now(),
  activity: [],
  records: Array.from({ length: 10 }, (_, index) => ({
    id: `sample-${index + 1}`,
    code: `AST-${String(index + 1).padStart(3, '0')}`,
    name: ['Cordless Drill', 'Safety Helmet', 'Extension Cable', 'Torque Wrench', 'Angle Grinder', 'Laser Measure', 'Impact Driver', 'Tool Case', 'Voltage Tester', 'Work Light'][index],
    status: 'available',
    quantity: 1,
    location: `Shelf ${String.fromCharCode(65 + (index % 4))}`,
    notes: '',
    createdAt: Date.now(),
  })),
};

const outputDir = resolve('output/pdf');
await mkdir(outputDir, { recursive: true });
const bytes = await generateLabelPdf(collection, { pageFormat: 'a4', template: 'standard' });
const output = resolve(outputDir, 'qry-track-labels-sample.pdf');
await writeFile(output, bytes);
console.log(output);
