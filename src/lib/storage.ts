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

export type Preferences = {
  autoSave: boolean;
  haptics: boolean;
};

export function readHistory(): SavedItem[] {
  try {
    const value = JSON.parse(localStorage.getItem(historyKey) ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function writeHistory(items: SavedItem[]): void {
  localStorage.setItem(historyKey, JSON.stringify(items.slice(0, 100)));
}

export function readPreferences(): Preferences {
  try {
    return {
      autoSave: true,
      haptics: true,
      ...JSON.parse(localStorage.getItem(preferencesKey) ?? '{}'),
    };
  } catch {
    return { autoSave: true, haptics: true };
  }
}

export function writePreferences(value: Preferences): void {
  localStorage.setItem(preferencesKey, JSON.stringify(value));
}

export function makeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
