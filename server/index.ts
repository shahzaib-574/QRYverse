import { resolve } from 'node:path';
import { createQryServer } from './app.js';

const port = Number(process.env.QRY_PORT ?? 8787);
const host = process.env.QRY_HOST ?? '127.0.0.1';
const databasePath = resolve(process.env.QRY_DATABASE_PATH ?? 'data/qryverse.sqlite');
const publicBaseUrl = process.env.QRY_PUBLIC_BASE_URL ?? `http://${host}:${port}`;
const corsOrigins = process.env.QRY_CORS_ORIGINS?.split(',').map((value) => value.trim()).filter(Boolean);
const { server } = createQryServer({ databasePath, publicBaseUrl, corsOrigins });

server.listen(port, host, () => {
  console.log(`QRYverse Cloud listening at ${publicBaseUrl}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => server.close(() => process.exit(0)));
