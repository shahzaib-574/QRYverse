import type { CloudClient, CloudSyncDocument } from '../cloud/client';
import { CloudApiError } from '../cloud/client';
import type { SyncAdapter, SyncEnvelope, SyncResult } from './types';

export class RemoteSyncAdapter implements SyncAdapter {
  readonly name = 'QRYverse Cloud';
  private version: number;

  constructor(private readonly client: CloudClient, version = 0) { this.version = version; }
  get remoteVersion(): number { return this.version; }

  async pull(local: SyncEnvelope): Promise<SyncResult> {
    const document = await this.client.getSync<SyncEnvelope>();
    this.version = document.version;
    if (!document.payload) return { status: 'synced', envelope: local, remoteVersion: this.version };
    if (!isSyncEnvelope(document.payload)) throw new Error('Cloud backup schema is not compatible with this app version.');
    return { status: 'synced', envelope: document.payload, remoteVersion: this.version };
  }

  async push(local: SyncEnvelope): Promise<SyncResult> {
    try {
      const document = await this.client.putSync(this.version, local);
      this.version = document.version;
      return { status: 'synced', envelope: local, remoteVersion: this.version };
    } catch (error) {
      if (error instanceof CloudApiError && error.code === 'sync_conflict') {
        const current = error.details as CloudSyncDocument<SyncEnvelope> | undefined;
        if (current?.payload && isSyncEnvelope(current.payload)) {
          this.version = current.version;
          return { status: 'conflict', envelope: current.payload, remoteVersion: current.version };
        }
      }
      throw error;
    }
  }
}

export function isSyncEnvelope(value: unknown): value is SyncEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Partial<SyncEnvelope>;
  return item.schemaVersion === 1 && typeof item.deviceId === 'string' && typeof item.updatedAt === 'number' && Array.isArray(item.collections) && Boolean(item.business && typeof item.business === 'object');
}
