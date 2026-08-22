# QRYverse

QRYverse is the public home of QRY, a local-first QR companion for Android and the web. It combines safe scanning, clear result previews, static QR generation, an organized personal library, and local business workflows. The Play v1 launch is ad-supported; hosted redirects, cloud accounts, billing, enforced teams, branding plans, and custom domains remain future roadmap options.

## Included in this MVP

- Native Android QR scanning through ML Kit
- Gallery-image scanning with multi-code selection
- Haptic confirmation and native share/save export
- Browser fallback for pasting and inspecting QR payloads
- On-device URL warning checks with transparent explanations
- Recognition for links, Wi-Fi, contacts, email, phone, SMS, locations, and text
- Static QR creation for websites, Wi-Fi, contacts, and text
- High-resolution PNG export and four brand colors
- Persistent local history, search, filters, favorites, and preferences
- Honest Studio preview separating local features from backend-dependent work
- QRY Track operations workspaces for assets, attendance, and inventory
- Eight additional workflow packs for maintenance, inspections, visitors, vehicles, rentals, facilities, deliveries, and training
- Unique record QR labels, quick actions, duplicate attendance protection, and activity history
- Recurring due dates, assignments, priorities, checklists, inspection evidence photos, and completion history
- Mapped CSV bulk import plus CSV export for Track workspaces
- Print-ready A4/Letter QR label sheets in three densities
- Validated JSON backup restore with safe merge or explicit replacement
- Business operations center with alerts, automation rules, team-role staging, portfolio CSV, and branded PDF reports
- Local dynamic campaigns with editable destinations, pause/resume, QR export, and privacy-conscious scan counts
- Android custom-scheme deep links for opening Track records and local campaigns
- English-first UI; Urdu/RTL translation groundwork is deferred until the full surface is translated and device-tested
- Local crash recovery and privacy-scrubbed diagnostic export
- Ad-supported launch boundary with no purchase surface or billing SDK bundled
- AdMob adaptive-banner integration with UMP consent and test-ID-safe defaults
- Development-only cloud foundation for authenticated backup and hosted redirects; deliberately disabled in the v1 Play profile
- Modern responsive soft-neumorphic UI with light/dark/system themes and accessible navigation
- Google Play listing copy, data-safety worksheet, legal-page drafts, icon, feature graphic, and eight native phone screenshots

## Run locally

```powershell
npm install
npm run dev
```

To exercise accounts, explicit cross-device backup, and hosted dynamic redirects, start the optional local cloud service in another terminal:

```powershell
npm run server:start
```

The browser client defaults to `http://127.0.0.1:8787`. Server data is stored in ignored `data/qryverse.sqlite`. See [CLOUD_BACKEND.md](./CLOUD_BACKEND.md) before exposing the service beyond local development.

## Verify

```powershell
npm run test
npm run lint
npm run server:typecheck -- --noEmit
npm run server:build
npm run build
python scripts/prepare-play-screenshots.py
npm audit --omit=dev --audit-level=high
```

GitHub Actions runs the same web, server, Play-asset, dependency-audit, and Android debug-candidate checks for pushes to `main` and pull requests.

## Android

```powershell
npm run android:sync
npm run android:debug
```

On a machine without a global JDK/Android SDK, the checksum-verified workspace-local JDK 21 and API 36 toolchain can be used with:

```powershell
npm run android:local-clean
npm run android:local-verify
```

The verification command applies and checks the reviewed native AdMob compatibility patch, builds the installable debug APK, runs Android lint and JVM release-contract tests, compiles the on-device contract test APK, and audits the actual APK's signing, manifest, SDK levels, AdMob/UMP profile, ABI coverage, and 16 KiB alignment. Outputs are written under `android/app/build/outputs/apk/`. See [ANDROID_RELEASE_CHECKLIST.md](./ANDROID_RELEASE_CHECKLIST.md) for artifact verification, device testing, signing, and Play rollout steps.

Use `npm run android:local-bundle` only after release signing and Play configuration are ready.

The Android project requests scanner camera access only when the user starts a live scan. A separate evidence-photo camera or picker opens only when the user deliberately chooses to attach evidence to a Track action.

Advertising uses AdMob rather than website AdSense. Development stays on Google's official test inventory until production IDs and an explicit `VITE_ADMOB_TEST_MODE=false` are supplied. See [ADMOB_RELEASE_SETUP.md](./ADMOB_RELEASE_SETUP.md).

The visual and interaction rationale is documented in [UI_UX_DECISIONS.md](./UI_UX_DECISIONS.md). Play listing copy and data disclosures are in [GOOGLE_PLAY_LISTING.md](./GOOGLE_PLAY_LISTING.md) and [PLAY_DATA_SAFETY.md](./PLAY_DATA_SAFETY.md).

## Product boundary

The current safety indicator performs explainable on-device heuristics. It does not claim live malware or reputation checking. A future production service can add an opt-in URL reputation API without silently uploading every scan.

## QRY Track storage boundary

The ad-supported v1 build does not apply a paid workspace or record quota. Data remains local and exportable. Track persistence is committed before UI success and is size-guarded at 3 MiB so a WebView quota failure cannot silently discard a change; evidence actions keep the sheet open and let the user remove a pending photo before retrying.

Bulk import accepts a header-based CSV and previews validation and duplicates before applying changes. Label Studio creates generic print sheets; select Actual size or 100% in the print dialog. JSON restore validates the backup before offering a non-destructive merge or an explicit local replacement.

## Deferred billing boundary

The first Google Play release is ad-supported and deliberately does not bundle RevenueCat, Google Play Billing, a purchase surface, or a billing permission. `src/lib/billing.ts` remains an inert adapter boundary for a separately reviewed future release.

If paid plans are introduced later, treat that as a separately tested release. [PLAY_BILLING_SETUP.md](./PLAY_BILLING_SETUP.md) records the opt-in steps and the data-safety, policy, entitlement, restore, cancellation, and expiry gates that must be completed first.

## Diagnostics and sync

Up to 20 diagnostic events are held locally. Messages are scrubbed for URLs, email addresses, and phone-like numbers, and never include scan payloads or Track records by design. Users can export or erase these events from Studio.

`LocalOnlySyncAdapter` keeps offline mode explicit. The first Play profile leaves `VITE_QRY_CLOUD_API_URL` unset, so no account or QRYverse server connection is available. The optional `RemoteSyncAdapter` and tenant-isolated server remain development foundations until the production controls in `CLOUD_BACKEND.md` are complete.

Webhook and custom-domain values can be staged locally. QRY contacts a webhook only through the explicit test action. Cloud activation, email delivery, custom-domain verification, and DNS are post-launch deployment work, not claims of the v1 Play binary. See [PLAY_LAUNCH_PROFILE.md](./PLAY_LAUNCH_PROFILE.md).
