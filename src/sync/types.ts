import type { TrackCollection } from '../track/store';
import type { BusinessState } from '../business/store';

export type SyncEnvelope = {
  schemaVersion: 1;
  deviceId: string;
  updatedAt: number;
  collections: TrackCollection[];
  business: BusinessState;
};

export type SyncResult = {
  status: 'local-only' | 'synced' | 'conflict';
  envelope: SyncEnvelope;
  remoteVersion?: number;
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
