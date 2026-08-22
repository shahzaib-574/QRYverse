# QRYverse Cloud

QRYverse Cloud is the optional hosted layer for authenticated organization backup and dynamic QR redirects. The mobile/web client remains fully useful without it and performs no automatic upload when an account is connected.

## Included

- Email/password registration and login using scrypt password hashing
- Random bearer sessions stored only as SHA-256 hashes in the database
- Organization membership and tenant-scoped data access
- Manual versioned pull/push with optimistic conflict rejection
- Owner/manager-controlled hosted campaign creation, edits, pause, and deletion
- Owner-only permanent cloud account deletion with transactional tenant cleanup and session revocation
- Stable public redirect paths at `/r/{slug}`
- Daily aggregate scan counts without persisted IP addresses, user agents, or raw scan events
- Login/register and redirect rate limits, strict JSON body limits, CORS allowlists, HTTPS destination validation, and baseline security headers

## Local development

Node 22.5 or newer is required for the built-in SQLite API.

```powershell
npm install
npm run server:start
```

In a second terminal:

```powershell
npm run dev
```

Open QRY Studio, use the default `http://127.0.0.1:8787` service URL, and create an organization. The database is created at `data/qryverse.sqlite` and is ignored by Git.

Run the backend contract test with:

```powershell
npm exec -- tsx server/selfcheck.ts
npm run server:typecheck
```

For a containerized beta deployment with a persistent volume:

```powershell
$env:QRY_PUBLIC_BASE_URL='https://go.example.com'
$env:QRY_CORS_ORIGINS='https://app.example.com'
docker compose up --build
```

Terminate TLS at the reverse proxy and keep the `/data` volume persistent and backed up.

## Configuration

| Variable | Purpose | Development default |
| --- | --- | --- |
| `QRY_HOST` | Bind address | `127.0.0.1` |
| `QRY_PORT` | HTTP port | `8787` |
| `QRY_DATABASE_PATH` | SQLite database file | `data/qryverse.sqlite` |
| `QRY_PUBLIC_BASE_URL` | Origin embedded in public campaign URLs | `http://127.0.0.1:8787` |
| `QRY_CORS_ORIGINS` | Comma-separated allowed client origins | Local Vite origins |
| `VITE_QRY_CLOUD_API_URL` | Client's cloud origin | `http://127.0.0.1:8787` in Vite development; disabled when omitted from a production build |

Only variables prefixed with `VITE_` are included in the browser/mobile bundle. Never put database credentials, signing material, service credentials, or other secrets in them.

Production clients fail closed when `VITE_QRY_CLOUD_API_URL` is absent: the account form is replaced with an offline-availability notice, saved development origins are ignored, and no cloud login request can be made. Set this variable to the deployed HTTPS origin before building only when the hosted service and its privacy disclosures are ready.

## API surface

- `GET /v1/health`
- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `POST /v1/auth/logout`
- `GET /v1/me`
- `DELETE /v1/account`
- `GET|PUT /v1/sync`
- `GET /v1/campaigns`
- `PUT|DELETE /v1/campaigns/{id}`
- `GET /v1/campaigns/{id}/analytics`
- `GET /r/{slug}`

## Account deletion and privacy

An authenticated organization owner can call `DELETE /v1/account`. The operation is immediate and transactional in the live database: it revokes every session belonging to a member of that organization, deletes the organization, and cascades deletion to its memberships, cloud sync document, hosted campaigns, and daily campaign analytics. User records that have no remaining organization membership are also deleted. A user that belongs to another organization keeps that user record, but all of their sessions are revoked and they must sign in again. Data belonging to every other organization remains untouched.

The endpoint returns `204 No Content`; its bearer token becomes invalid as part of the same transaction. This cloud operation does not delete records stored only on a user's device. The client exposes it as `CloudClient.deleteAccount()` so an in-app deletion confirmation flow can invoke the same API.

Production operators must apply a documented, finite retention period to encrypted backups and disclose that period in the privacy policy. Backups must not be restored in a way that silently recreates an account a user deleted.

## Production boundary

The included server is suitable for local development, a controlled beta, or a single-instance deployment with a persistent volume. Before accepting public production traffic:

1. Terminate TLS and set an HTTPS `QRY_PUBLIC_BASE_URL`.
2. Run behind a trusted reverse proxy and add proxy-aware distributed rate limiting.
3. Store the SQLite file on encrypted persistent storage and automate tested, off-site backups. For horizontally scaled operation, migrate the same tenant model to PostgreSQL.
4. Add email verification, password reset, session/device management, organization invitations, and secure native token storage.
5. Add account export, configurable backup retention, audit logs, abuse reporting, domain reputation controls, and operational monitoring.
6. Replace global slug uniqueness with verified-domain-plus-slug uniqueness when custom domains are introduced.
7. Review privacy policy and Data Safety disclosures against the final hosting, monitoring, and backup providers.

Sync payloads are protected by HTTPS in production but are not application-level encrypted inside SQLite. Do not claim end-to-end encryption without adding client-held encryption keys and a recovery design.
