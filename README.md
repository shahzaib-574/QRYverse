# QRYverse

QRYverse is the public home of QRY, a local-first QR companion for Android and the web. The product combines safe scanning, clear result previews, static QR generation, an organized personal library, and business workflows. Monetization is centered on QRY Studio: dynamic redirects, analytics, teams, branding, and custom domains.

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
- Android app links for opening Track records and dynamic campaigns from external scanners
- English and Urdu UI with persistent RTL switching
- Local crash recovery and privacy-scrubbed diagnostic export
- RevenueCat/Google Play subscription adapter gated by environment configuration
- Explicit local-only sync adapter ready for a future authenticated backend

## Run locally

```powershell
npm install
npm run dev
```

## Verify

```powershell
npm run test
npm run lint
npm run build
```

## Android

```powershell
npm run android:sync
npm run android:debug
```

On a machine without a global JDK/Android SDK, the checksum-verified workspace-local JDK 21 and API 36 toolchain can be used with:

```powershell
npm run android:local-debug
```

The installable debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. See [ANDROID_RELEASE_CHECKLIST.md](./ANDROID_RELEASE_CHECKLIST.md) for artifact verification, device testing, signing, and Play rollout steps.

Use `npm run android:local-bundle` only after release signing and Play configuration are ready.

The Android project requests camera access only when the user starts a scan.

## Product boundary

The current safety indicator performs explainable on-device heuristics. It does not claim live malware or reputation checking. A future production service can add an opt-in URL reputation API without silently uploading every scan.

## QRY Track limits

The beta presents a free allowance of one workspace and 25 records. Data remains fully local and exportable. Paid enforcement is intentionally deferred until Play Billing is configured; the intended upgrade value is higher record limits, additional workspaces, team sync, permissions, and vertical workflow packs.

Bulk import accepts a header-based CSV and previews validation, duplicates, and plan limits before applying changes. Label Studio creates generic print sheets; select Actual size or 100% in the print dialog. JSON restore validates the backup before offering a non-destructive merge or an explicit local replacement.

## Live billing configuration

The application includes a real RevenueCat adapter, offering retrieval, entitlement checks, purchases, and restore flow. It remains unable to initiate transactions until a public Android SDK key is supplied. See [PLAY_BILLING_SETUP.md](./PLAY_BILLING_SETUP.md).

Only the public app-specific SDK key belongs in `VITE_REVENUECAT_ANDROID_API_KEY`. Secret RevenueCat or Google credentials must never be included in the app bundle.

## Diagnostics and sync

Up to 20 diagnostic events are held locally. Messages are scrubbed for URLs, email addresses, and phone-like numbers, and never include scan payloads or Track records by design. Users can export or erase these events from Studio.

`LocalOnlySyncAdapter` makes the offline boundary explicit. No remote writes occur until an authenticated backend, access rules, conflict policy, and deletion workflow have been selected and reviewed.

Webhook, sync API, and custom-domain endpoints can be staged in the app. QRY performs no hidden network calls: the webhook is contacted only through its explicit test action, while authenticated sync, public redirects, email delivery, and DNS activation remain deployment responsibilities.
