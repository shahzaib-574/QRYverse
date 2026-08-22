import type { RiskLevel, ScanKind } from './qr';

export type SavedItem = {
  id: string;
  payload: string;
  title: string;
  kind: ScanKind;
  risk: RiskLevel;
  createdAt: number;
  source: 'scan' | 'created';
  favourite: boolean;
};

const historyKey = 'qry.history.v1';
const preferencesKey = 'qry.preferences.v1';
export const maxHistoryStorageBytes = 512 * 1024;
export const maxHistoryItems = 100;

export class LocalStorageWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocalStorageWriteError';
  }
}

export type Preferences = {
  autoSave: boolean;
  haptics: boolean;
  theme: 'system' | 'light' | 'dark';
};

export function readHistory(): SavedItem[] {
  try {
    const value = JSON.parse(localStorage.getItem(historyKey) ?? '[]') as unknown;
    if (!Array.isArray(value)) return [];
    const kinds = new Set(['link', 'wifi', 'contact', 'email', 'phone', 'sms', 'location', 'text']);
    const risks = new Set(['clear', 'caution', 'danger']);
    return value.slice(0, maxHistoryItems).flatMap((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
      const item = entry as Record<string, unknown>;
      const payload = safeStoredText(item.payload, 64 * 1024);
      if (!payload) return [];
      return [{
        id: safeStoredText(item.id, 120) || makeId(),
        payload,
        title: safeStoredText(item.title, 300) || 'Saved code',
        kind: kinds.has(String(item.kind)) ? item.kind as ScanKind : 'text',
        risk: risks.has(String(item.risk)) ? item.risk as RiskLevel : 'clear',
        createdAt: Number.isFinite(Number(item.createdAt)) && Number(item.createdAt) > 0 ? Number(item.createdAt) : Date.now(),
        source: item.source === 'created' ? 'created' : 'scan',
        favourite: item.favourite === true,
      } satisfies SavedItem];
    });
  } catch {
    return [];
  }
}

export function writeHistory(items: SavedItem[]): void {
  if (items.length > maxHistoryItems) {
    throw new LocalStorageWriteError('Your Library already has 100 codes. Delete an unused code, then try saving again.');
  }
  const serialized = JSON.stringify(items);
  if (new TextEncoder().encode(serialized).byteLength > maxHistoryStorageBytes) {
    throw new LocalStorageWriteError('This code was not saved because the Library is full. Delete large or unused items and try again.');
  }
  try {
    localStorage.setItem(historyKey, serialized);
  } catch {
    throw new LocalStorageWriteError('This change was not saved because device storage is unavailable or full. Free app storage and try again.');
  }
}

export function upsertHistoryItem(items: SavedItem[], incoming: SavedItem): SavedItem[] {
  const existing = items.find((item) => item.payload === incoming.payload);
  const saved = existing ? {
    ...incoming,
    id: existing.id,
    favourite: existing.favourite,
    source: existing.source === 'created' || incoming.source === 'created' ? 'created' as const : 'scan' as const,
  } : incoming;
  return [saved, ...items.filter((item) => item.payload !== incoming.payload)];
}

export function readPreferences(): Preferences {
  try {
    return {
      autoSave: true,
      haptics: true,
      theme: 'system',
      ...JSON.parse(localStorage.getItem(preferencesKey) ?? '{}'),
    };
  } catch {
    return { autoSave: true, haptics: true, theme: 'system' };
  }
}

export function writePreferences(value: Preferences): void {
  try {
    localStorage.setItem(preferencesKey, JSON.stringify(value));
  } catch {
    throw new LocalStorageWriteError('This preference could not be saved because device storage is unavailable.');
  }
}

export function makeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function clearAllQRYverseLocalData(): void {
  for (const key of [historyKey, preferencesKey, 'qry.track.v1', 'qry.business.v1', 'qry.diagnostics.v1', 'qry.locale.v1', 'qry.cloud.api.v1', 'qry.device.id']) {
    localStorage.removeItem(key);
  }
}

function safeStoredText(value: unknown, limit: number): string {
  return typeof value === 'string' ? Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 && code !== 9 && code !== 10 && code !== 13 ? ' ' : character;
  }).join('').trim().slice(0, limit) : '';
}
