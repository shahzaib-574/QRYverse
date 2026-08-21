import type { TrackCollection } from '../track/store';

export type SyncEnvelope = {
  schemaVersion: 1;
  deviceId: string;
  updatedAt: number;
  collections: TrackCollection[];
};

export type SyncResult = {
  status: 'local-only' | 'synced' | 'conflict';
  envelope: SyncEnvelope;
};

export interface SyncAdapter {
  readonly name: string;
  pull(local: SyncEnvelope): Promise<SyncResult>;
  push(local: SyncEnvelope): Promise<SyncResult>;
}

export class LocalOnlySyncAdapter implements SyncAdapter {
  readonly name = 'This device';

  async pull(local: SyncEnvelope): Promise<SyncResult> {
    return { status: 'local-only', envelope: local };
  }

  async push(local: SyncEnvelope): Promise<SyncResult> {
    return { status: 'local-only', envelope: local };
  }
}
