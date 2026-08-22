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

## Phase 2 — Closed beta (implemented; hardware/store validation pending)

- Gallery-image scanning and multi-code selection — implemented
- Share sheet integration and native file saving — implemented
- Haptic scan confirmation — implemented
- Accessibility and English-first release UI — implemented; full Urdu/RTL translation and device QA deferred
- Local privacy-scrubbed crash diagnostics and recovery UI — implemented
- Ad-supported launch boundary — implemented; no paid-plan UI or billing SDK is bundled
- Privacy-preserving product analytics — pending consent and vendor decision
- Modern minimalist soft-neumorphic design system, responsive rail/navigation, theme modes, dialog accessibility, and destructive-action safeguards — implemented
- AdMob adaptive banner and UMP consent/privacy-options flow — implemented with test IDs; production console IDs pending

Success gate: 30-day scan retention above 12%, crash-free sessions above 99.5%, and at least 20 recurring small-business testers.

## QRY Track — monetization expansion (implemented locally)

Market review found ordinary QR generation, landing pages, and analytics crowded, while operational scanning products command substantially higher recurring prices. QRY Track adds one reusable scan-to-update engine across several paying niches without requiring a backend for its first version.

- Asset checkout: available, checked out, returned, and needs service
- Attendance: present, late, checkout, and duplicate-scan protection
- Inventory: quantity adjustment and stock status
- Unique permanent record codes, printable previews, and multi-record PDF label sheets
- Append-only local activity history
- Mapped CSV import with duplicate handling and pre-apply validation
- CSV export plus validated JSON backup restore (merge or replace)
- Maintenance, inspection, visitor, vehicle, rental, facility, delivery, and training workflow packs
- Recurring schedules, assignees, priorities, checklists, evidence photos, and inspection history
- On-device alerts for due dates, low stock, service needs, and failed inspections
- Team-role staging, business reporting, automation settings, and opt-in webhook testing
- Local dynamic campaigns with stable codes, editable destinations, pause/resume, and scan counts
- Android custom-scheme Track and campaign links; verified HTTPS App Links deferred until a controlled domain exists

Post-launch packaging experiments (not enforced in the v1 binary):

- Launch Free: local workflows without a paid quota, bounded by safe device storage and backup/export controls
- Track Pro: USD 6.99/month or USD 49.99/year, higher limits and all templates
- Business: USD 14.99–24.99/month later, team sync, roles, and consolidated analytics
- Event Pass: USD 9.99/event later for organizers preferring one-off access

## Phase 3 — Studio backend (hosted foundation implemented; production deployment pending)

- Authenticated accounts and tenant-isolated organization workspaces — implemented
- Versioned manual cross-device backup with conflict rejection — implemented
- Stable hosted paths with editable redirect rules — implemented; production domain pending
- Daily scan aggregation without persisted IP addresses — implemented
- Custom domains, bulk imports, and exports
- Owner-only transactional cloud account deletion and session revocation — implemented
- Subscription enforcement, quotas, and invoices — deferred to a separately reviewed post-launch release
- Restaurant menu and event campaign templates

Success gate: at least 5% of active creators start a Studio trial and at least 25% of trials convert to paid.

The client contains local-only and remote sync adapters, but the exact v1 Play profile is cloud-off and rejects a release build with `VITE_QRY_CLOUD_API_URL` set. The hosted foundation includes authentication, tenant isolation, conflict rejection, explicit network actions, hosted-campaign deletion, and owner account deletion for development. Production activation still requires HTTPS termination, encrypted-backup operations, monitoring, a public web deletion request channel, data export, and a reviewed retention policy.

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
