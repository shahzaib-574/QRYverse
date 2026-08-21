import { scrubDiagnosticText } from './scrub';

export type DiagnosticEvent = {
  id: string;
  kind: 'render' | 'runtime' | 'promise' | 'native';
  message: string;
  stack?: string;
  occurredAt: number;
  appVersion: string;
};

const key = 'qry.diagnostics.v1';
const maxEvents = 20;

export function captureDiagnostic(kind: DiagnosticEvent['kind'], error: unknown): void {
  const source = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Unknown application error');
  const event: DiagnosticEvent = {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`,
    kind,
    message: scrubDiagnosticText(source.message).slice(0, 300),
    stack: source.stack ? scrubDiagnosticText(source.stack).split('\n').slice(0, 6).join('\n') : undefined,
    occurredAt: Date.now(),
    appVersion: '0.2.0-beta',
  };
  writeDiagnostics([event, ...readDiagnostics()].slice(0, maxEvents));
}

export function installGlobalDiagnostics(): () => void {
  const onError = (event: ErrorEvent) => captureDiagnostic('runtime', event.error ?? event.message);
  const onRejection = (event: PromiseRejectionEvent) => captureDiagnostic('promise', event.reason);
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}

export function readDiagnostics(): DiagnosticEvent[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function clearDiagnostics(): void {
  localStorage.removeItem(key);
}

export function diagnosticsExport(): string {
  return JSON.stringify({
    generatedAt: new Date().toISOString(),
    privacy: 'No scan payloads, record contents, contact data, or browsing history are collected.',
    events: readDiagnostics(),
  }, null, 2);
}

function writeDiagnostics(events: DiagnosticEvent[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(events));
  } catch {
    // Diagnostics must never interfere with the app.
  }
}
