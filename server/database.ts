import { DatabaseSync } from 'node:sqlite';
import { createSessionToken, hashPassword, hashToken, makeId, verifyPassword } from './security.js';

export type Role = 'owner' | 'manager' | 'operator' | 'viewer';
export type AuthIdentity = {
  userId: string;
  email: string;
  name: string;
  organizationId: string;
  organizationName: string;
  role: Role;
};
export type CampaignRow = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  destination: string;
  color: string;
  active: number;
  total_scans: number;
  created_at: number;
  updated_at: number;
  last_scan_at: number | null;
};

type UserPasswordRow = { id: string; email: string; name: string; password_hash: string; password_salt: string };

export class QryDatabase {
  readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    this.migrate();
  }

  close(): void { this.db.close(); }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS memberships (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK(role IN ('owner','manager','operator','viewer')),
        created_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, organization_id)
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions(expires_at);
      CREATE TABLE IF NOT EXISTS sync_documents (
        organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        payload TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        updated_by TEXT NOT NULL REFERENCES users(id)
      );
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        destination TEXT NOT NULL,
        color TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        total_scans INTEGER NOT NULL DEFAULT 0,
        last_scan_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS campaigns_organization_id ON campaigns(organization_id);
      CREATE TABLE IF NOT EXISTS campaign_scan_days (
        campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        day TEXT NOT NULL,
        count INTEGER NOT NULL,
        PRIMARY KEY (campaign_id, day)
      );
    `);
  }

  register(input: { email: string; password: string; name: string; organizationName: string }): { token: string; identity: AuthIdentity } {
    const now = Date.now();
    const userId = makeId();
    const organizationId = makeId();
    const credentials = hashPassword(input.password);
    const session = createSessionToken();
    this.transaction(() => {
      this.db.prepare('INSERT INTO users (id,email,name,password_hash,password_salt,created_at) VALUES (?,?,?,?,?,?)').run(userId, input.email, input.name, credentials.hash, credentials.salt, now);
      this.db.prepare('INSERT INTO organizations (id,name,created_at) VALUES (?,?,?)').run(organizationId, input.organizationName, now);
      this.db.prepare("INSERT INTO memberships (user_id,organization_id,role,created_at) VALUES (?,?,'owner',?)").run(userId, organizationId, now);
      this.db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)').run(session.tokenHash, userId, now + 30 * 86_400_000, now);
    });
    return { token: session.token, identity: { userId, email: input.email, name: input.name, organizationId, organizationName: input.organizationName, role: 'owner' } };
  }

  login(email: string, password: string): { token: string; identity: AuthIdentity } | undefined {
    const user = this.db.prepare('SELECT id,email,name,password_hash,password_salt FROM users WHERE email = ?').get(email) as UserPasswordRow | undefined;
    if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) return undefined;
    const identity = this.identityForUser(user.id);
    if (!identity) return undefined;
    const session = createSessionToken();
    const now = Date.now();
    this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
    this.db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)').run(session.tokenHash, user.id, now + 30 * 86_400_000, now);
    return { token: session.token, identity };
  }

  authenticate(token: string): AuthIdentity | undefined {
    const now = Date.now();
    return this.db.prepare(`SELECT u.id AS userId,u.email,u.name,o.id AS organizationId,o.name AS organizationName,m.role
      FROM sessions s JOIN users u ON u.id=s.user_id JOIN memberships m ON m.user_id=u.id JOIN organizations o ON o.id=m.organization_id
      WHERE s.token_hash=? AND s.expires_at>? ORDER BY m.created_at LIMIT 1`).get(hashToken(token), now) as AuthIdentity | undefined;
  }

  logout(token: string): void { this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(token)); }

  deleteOrganizationAccount(identity: AuthIdentity): boolean {
    return this.transaction(() => {
      const members = this.db.prepare('SELECT user_id FROM memberships WHERE organization_id=?').all(identity.organizationId) as Array<{ user_id: string }>;
      if (!members.some((member) => member.user_id === identity.userId)) return false;

      // Sessions are user-scoped today, so revoke every session for the affected
      // members before deleting the tenant. A member that also belongs to another
      // organization keeps that user record but must authenticate again.
      for (const member of members) {
        this.db.prepare('DELETE FROM sessions WHERE user_id=?').run(member.user_id);
      }

      const deleted = Number(this.db.prepare('DELETE FROM organizations WHERE id=?').run(identity.organizationId).changes) > 0;
      if (!deleted) return false;

      // Memberships cascade with the organization. Remove only users that no
      // longer belong to any organization, preserving accounts shared elsewhere.
      for (const member of members) {
        this.db.prepare('DELETE FROM users WHERE id=? AND NOT EXISTS (SELECT 1 FROM memberships WHERE user_id=?)').run(member.user_id, member.user_id);
      }
      return true;
    });
  }

  private identityForUser(userId: string): AuthIdentity | undefined {
    return this.db.prepare(`SELECT u.id AS userId,u.email,u.name,o.id AS organizationId,o.name AS organizationName,m.role
      FROM users u JOIN memberships m ON m.user_id=u.id JOIN organizations o ON o.id=m.organization_id
      WHERE u.id=? ORDER BY m.created_at LIMIT 1`).get(userId) as AuthIdentity | undefined;
  }

  getSync(organizationId: string): { version: number; payload: unknown; updatedAt: number } | undefined {
    const row = this.db.prepare('SELECT version,payload,updated_at AS updatedAt FROM sync_documents WHERE organization_id=?').get(organizationId) as { version: number; payload: string; updatedAt: number } | undefined;
    return row ? { ...row, payload: JSON.parse(row.payload) } : undefined;
  }

  putSync(identity: AuthIdentity, baseVersion: number, payload: unknown): { version: number; payload: unknown; updatedAt: number } | { conflict: true; current: { version: number; payload: unknown; updatedAt: number } } {
    return this.transaction(() => {
      const current = this.getSync(identity.organizationId);
      if ((current?.version ?? 0) !== baseVersion) return { conflict: true as const, current: current ?? { version: 0, payload: null, updatedAt: 0 } };
      const version = baseVersion + 1;
      const updatedAt = Date.now();
      this.db.prepare(`INSERT INTO sync_documents (organization_id,version,payload,updated_at,updated_by) VALUES (?,?,?,?,?)
        ON CONFLICT(organization_id) DO UPDATE SET version=excluded.version,payload=excluded.payload,updated_at=excluded.updated_at,updated_by=excluded.updated_by`)
        .run(identity.organizationId, version, JSON.stringify(payload), updatedAt, identity.userId);
      return { version, payload, updatedAt };
    });
  }

  listCampaigns(organizationId: string): CampaignRow[] {
    return this.db.prepare('SELECT * FROM campaigns WHERE organization_id=? ORDER BY created_at DESC').all(organizationId) as CampaignRow[];
  }

  getCampaignForOrganization(id: string, organizationId: string): CampaignRow | undefined {
    return this.db.prepare('SELECT * FROM campaigns WHERE id=? AND organization_id=?').get(id, organizationId) as CampaignRow | undefined;
  }

  getCampaignBySlug(slug: string): CampaignRow | undefined {
    return this.db.prepare('SELECT * FROM campaigns WHERE slug=?').get(slug) as CampaignRow | undefined;
  }

  upsertCampaign(identity: AuthIdentity, input: { id: string; name: string; slug: string; destination: string; color: string; active: boolean }): CampaignRow {
    const now = Date.now();
    const existing = this.db.prepare('SELECT organization_id,created_at FROM campaigns WHERE id=?').get(input.id) as { organization_id: string; created_at: number } | undefined;
    if (existing && existing.organization_id !== identity.organizationId) throw new Error('Campaign does not belong to this organization.');
    this.db.prepare(`INSERT INTO campaigns (id,organization_id,name,slug,destination,color,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,slug=excluded.slug,destination=excluded.destination,color=excluded.color,active=excluded.active,updated_at=excluded.updated_at`)
      .run(input.id, identity.organizationId, input.name, input.slug, input.destination, input.color, input.active ? 1 : 0, existing?.created_at ?? now, now);
    return this.getCampaignForOrganization(input.id, identity.organizationId)!;
  }

  deleteCampaign(id: string, organizationId: string): boolean {
    return Number(this.db.prepare('DELETE FROM campaigns WHERE id=? AND organization_id=?').run(id, organizationId).changes) > 0;
  }

  recordCampaignScan(id: string): void {
    const now = Date.now();
    const day = new Date(now).toISOString().slice(0, 10);
    this.transaction(() => {
      this.db.prepare('UPDATE campaigns SET total_scans=total_scans+1,last_scan_at=? WHERE id=?').run(now, id);
      this.db.prepare(`INSERT INTO campaign_scan_days (campaign_id,day,count) VALUES (?,?,1)
        ON CONFLICT(campaign_id,day) DO UPDATE SET count=count+1`).run(id, day);
    });
  }

  campaignAnalytics(id: string, organizationId: string): { total: number; lastScanAt: number | null; daily: Array<{ day: string; count: number }> } | undefined {
    const campaign = this.getCampaignForOrganization(id, organizationId);
    if (!campaign) return undefined;
    const daily = this.db.prepare('SELECT day,count FROM campaign_scan_days WHERE campaign_id=? ORDER BY day DESC LIMIT 90').all(id) as Array<{ day: string; count: number }>;
    return { total: campaign.total_scans, lastScanAt: campaign.last_scan_at, daily: daily.reverse() };
  }

  private transaction<T>(operation: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}
