# QRY implementation plan

## Product strategy

QRY uses a freemium acquisition loop: useful consumer scanning and static creation remain free, while businesses pay for dynamic codes and operational workflows. This avoids trying to charge users for functionality already present in phone cameras.

## Phase 1 — Local MVP (implemented)

- Android-ready React and Capacitor application
- Native ML Kit QR capture
- Result classification and transparent warning checks
- Local scan history, favorites, filters, and privacy preferences
- Static creation for link, Wi-Fi, contact, and text payloads
- PNG export and basic brand customization
- Studio product preview without simulated analytics

Success gate: builds cleanly, core payload rules pass self-checks, and Android debug APK installs and scans on at least two physical devices.

## Phase 2 — Closed beta (in progress)

- Gallery-image scanning and multi-code selection — implemented
- Share sheet integration and native file saving — implemented
- Haptic scan confirmation — implemented
- Accessibility and English/Urdu RTL localization — implemented
- Local privacy-scrubbed crash diagnostics and recovery UI — implemented
- Credential-gated Play Billing entitlement flow — implemented; store activation pending
- Privacy-preserving product analytics — pending consent and vendor decision

Success gate: 30-day scan retention above 12%, crash-free sessions above 99.5%, and at least 20 recurring small-business testers.

## QRY Track — monetization expansion (implemented locally)

Market review found ordinary QR generation, landing pages, and analytics crowded, while operational scanning products command substantially higher recurring prices. QRY Track adds one reusable scan-to-update engine across several paying niches without requiring a backend for its first version.

- Asset checkout: available, checked out, returned, and needs service
- Attendance: present, late, checkout, and duplicate-scan protection
- Inventory: quantity adjustment and stock status
- Unique permanent record codes, printable previews, and multi-record PDF label sheets
- Append-only local activity history
- Mapped CSV import with duplicate handling and plan-limit preview
- CSV export plus validated JSON backup restore (merge or replace)
- Maintenance, inspection, visitor, vehicle, rental, facility, delivery, and training workflow packs
- Recurring schedules, assignees, priorities, checklists, evidence photos, and inspection history
- On-device alerts for due dates, low stock, service needs, and failed inspections
- Team-role staging, business reporting, automation settings, and opt-in webhook testing
- Local dynamic campaigns with stable codes, editable destinations, pause/resume, and scan counts
- Android Track and campaign app links

Suggested packaging:

- Free: one workspace, 25 records, local backup
- Track Pro: USD 6.99/month or USD 49.99/year, higher limits and all templates
- Business: USD 14.99–24.99/month later, team sync, roles, and consolidated analytics
- Event Pass: USD 9.99/event later for organizers preferring one-off access

## Phase 3 — Studio backend (local client complete; hosted services pending)

- Authenticated accounts and organization workspaces
- Stable short domains with editable redirect rules — local campaign routing implemented; public redirect host pending
- Scan-event aggregation with retention controls — local scan counts implemented; hosted aggregation pending
- Custom domains, bulk imports, and exports
- Subscription enforcement, quotas, invoices, and account deletion
- Restaurant menu and event campaign templates

Success gate: at least 5% of active creators start a Studio trial and at least 25% of trials convert to paid.

The client now contains a typed `SyncAdapter` contract and an explicit local-only implementation. A remote adapter must not be activated until authentication, tenant isolation, conflict resolution, encryption, export, and deletion policies are selected.

## Phase 4 — Commercial launch

- Play Store listing experiments and referral loop
- Web dashboard for campaign management
- Agency/team plan and branded client reporting
- API keys, webhooks, and integration marketplace
- Abuse prevention, rate limits, and domain reputation monitoring

## Suggested pricing experiment

- Free: unlimited scans and static codes, three active dynamic codes later
- Creator: USD 3.99/month for 25 dynamic codes and 90-day analytics
- Business: USD 11.99/month for 250 codes, exports, and branding
- Team: USD 39/month for shared workspaces, custom domains, and API access

Pricing should be localized and tested after the beta establishes retention; it is not hard-coded into the MVP.
