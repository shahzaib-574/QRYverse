# QRYverse Google Play listing

This is the source of truth for the first production listing. Copy should be rechecked in Play Console because Google can change field limits and asset rules. Do not submit while any `[RELEASE ...]` placeholder remains.

## Core listing

**App name (20/30 characters)**
QRYverse: QR & Track

**Default language**
English (United States)

**Category**
Productivity

**Suggested Play tags**
QR code, Inventory, Productivity, Business, Utilities. Select only tags that are available in the current Play Console tag picker; do not force unrelated keywords.

**Short description (70/80 characters)**
Scan, create and organize QR codes, then track assets, stock and more.

## Full description

Meet QRYverse: a focused QR companion that turns a quick scan into something useful.

Preview a code before opening it, create clean QR codes in seconds, and keep important scans organized. When a label needs to do more, QRY Track adds practical offline workflows for assets, stock, attendance, inspections, maintenance, visitors, vehicles, rentals, facilities, deliveries, and training.

SCAN WITH CONTEXT

• Scan QR codes with your Android camera
• Read codes from an image in your gallery
• Preview links before choosing to open them
• Recognize web links, Wi-Fi details, contacts, email, phone, SMS, locations, and text
• Use clear, explainable safety hints for suspicious link patterns

CREATE AND ORGANIZE

• Create QR codes for links, plain text, Wi-Fi access, and vCard contacts
• Share or save a high-quality QR image
• Keep scans and creations in a searchable local library
• Star useful codes and control automatic history saving

TURN LABELS INTO ACTIONS

• Build offline-ready Track workspaces
• Generate unique codes for records
• Check assets in and out, update stock, mark attendance, and record inspections
• Add notes, due dates, assignees, checklists, and optional evidence photos
• Export records and activity for reporting or backup
• Generate printable QR labels

LOCAL-FIRST RELEASE

The first Play release creates no account and does not connect to QRYverse Cloud. Scanner, creator, library, Track, reports, labels, backups, and local campaigns work on the device. Export, share, webhook test, and destination-opening actions occur only when you choose them.

LOCAL-FIRST BY DESIGN

Camera and gallery scans are processed on your device. You decide what to save, export, share, publish, or back up. Camera access is used only after you start a live scan or deliberately choose to capture an evidence photo. QRYverse does not request your address book or device location.

QRYverse's link safety labels are on-device hints, not antivirus or a guarantee that a destination is safe. Always review a destination before opening it or acting on its instructions.

This first Android release is supported by ads and does not offer in-app purchases or subscriptions.

## Store asset plan

Create final raster assets from the checked-in QRY icon system. Avoid screenshots with test ads, test account emails, private QR payloads, browser chrome, debug overlays, or placeholder legal/contact text.

| Asset | Production deliverable | Creative direction |
| --- | --- | --- |
| High-resolution icon | `store-assets/qryverse-play-icon-512.png` — 512 × 512 PNG | Deep green field, cream QR geometry, one restrained coral module; no text |
| Feature graphic | `store-assets/qryverse-feature-graphic-1024x500.png` — 1024 × 500 PNG | Premium cream/green/coral QR-portal composition with no unsupported claims |
| Phone screenshots | `store-assets/screenshots/01-home.png` through `08-studio.png` — 719 × 1278 RGB PNG | Native 9:16 light-theme UI covering Home, result safety, creation, Library, Track, record actions, operations, and Studio |
| Optional 7-inch/10-inch tablet screenshots | Capture only after responsive tablet QA | Use actual tablet layouts; never upscale phone captures |
| Optional promo video | Public or unlisted YouTube URL; monetization off | 25–35 second product walkthrough with no misleading claims |

Before upload, verify the current Play Console requirements for accepted formats, file-size limits, pixel ranges, and device-specific screenshot groups.

### Screenshot sequence

1. `01-home.png` — scanner entry, permission rationale, and private-by-design positioning.
2. `02-scan-result.png` — recognizable URL preview and truthful on-device safety explanation.
3. `03-create.png` — creator modes and live QR preview.
4. `04-library.png` — populated local Library with filters.
5. `05-track.png` — QRY Track inventory workspace and operations entry points.
6. `06-record-actions.png` — fast inventory quantity actions.
7. `07-operations.png` — device-local reporting summary and export actions.
8. `08-studio.png` — local dynamic campaigns, manual backup boundary, and business tools.

### Play Console alt text

Add concise, factual alt text in Play Console for every uploaded graphic. Describe the visible experience instead of repeating keywords or making claims that the frame cannot prove, keep each description within the Console's current limit, and recheck it whenever a capture changes.

| Asset | Suggested alt text |
| --- | --- |
| Feature graphic | A sculpted green QR portal linking cards for inventory, workflows, and analytics. |
| `01-home.png` | QRYverse Home with private QR scanning, quick creation, and recent on-device activity. |
| `02-scan-result.png` | QR result preview showing the destination and explainable on-device link safety guidance. |
| `03-create.png` | QR creator with website, text, Wi-Fi, and contact modes beside a live code preview. |
| `04-library.png` | Local QR library with search, scan and creation filters, favorites, and item actions. |
| `05-track.png` | QRY Track inventory workspace with record totals, operations tools, and recent updates. |
| `06-record-actions.png` | Inventory record action sheet with quantity, status, and quick stock update controls. |
| `07-operations.png` | Device-local operations dashboard with reporting, export, import, labels, and backup tools. |
| `08-studio.png` | QRY Studio with local campaigns, scan counts, backup controls, and business tools. |

Capture checklist for every screenshot:

- Use production typography, icon, spacing, and one consistent production theme at 100% display scale.
- Use plausible fictional data and reserved domains such as `example.com`; never use a real person's details.
- Keep important UI and caption text away from edges and Play cropping zones.
- Show one idea per frame. The canonical captures contain no marketing overlays.
- Confirm text is legible at listing thumbnail size and passes contrast review.
- Use the same time, status-bar treatment, dataset, and visual rhythm across the set.
- Do not imply live threat intelligence, location tracking, contact access, team invitations, or automatic sync that the build does not provide.
- The current 719 × 1278 captures meet Play's mandatory upload dimensions. For eligibility in large recommendation formats, recapture at least four portrait frames from the exact release candidate at 1080 × 1920 or higher; never upscale the existing images.

## Play Console declarations

| Console area | Planned answer / action | Evidence or release condition |
| --- | --- | --- |
| Ads | **Yes, contains ads** for the ad-enabled free build | Google Mobile Ads SDK is integrated. Use production AdMob IDs only after consent and policy checks. |
| App access | **No sign-in; every launch feature is directly available** | Cloud and account surfaces are disabled in this binary. |
| Data safety | Complete from `PLAY_DATA_SAFETY.md` after final SDK/traffic verification | Form must match the exact production binary and vendor contracts. |
| Privacy policy | `[RELEASE PUBLIC HTTPS URL]/privacy.html` | Replace all placeholders and publish before submission. |
| Account deletion URL | Not applicable to the v1 binary | It creates no account. Publish `[RELEASE PUBLIC HTTPS URL]/account-deletion.html` as local-data clearing guidance, not as evidence of an active account service. |
| Content rating | Complete IARC questionnaire truthfully | Utility/productivity app; dynamic user-selected destinations and ads must be considered. |
| Target audience | **Adults ages 18 and older only** | The publisher must confirm **18 and over only** in Google Play and compatible AdMob console declarations before release. The app has no age gate or reliable user-age signal, so SDK child-directed and under-age-of-consent request tags remain unspecified. |
| News | No | The app is not a news publisher or aggregator. |
| Health | No health features | Do not position inspection/attendance tools as medical functions. |
| Financial features | No financial product or transaction functionality | QR values may contain arbitrary user text, but QRYverse provides no payment service. |
| Government | No | Do not imply government affiliation. |
| COVID-19 | No | No exposure-notification or health-status functionality. |
| Advertising ID | Declare use if the merged release manifest includes `com.google.android.gms.permission.AD_ID` | Expected from Google Mobile Ads; inspect the final merged manifest. |
| Permissions | Camera, internet, vibration/network state, Advertising ID/AdServices, wake lock/foreground service, and other SDK-merged permissions in the candidate | Camera is optional hardware and requested in context. Billing must be absent from this ad-supported launch candidate. Explain sensitive permissions and verify every merged entry against SDK behavior. |
| Billing | **No in-app purchases in the first release** | RevenueCat and Google Play Billing are not bundled; the plans surface is disabled. Re-evaluate this declaration and Data safety before any future paid release. |
| User-generated content | No public social feed or first-party public hosting | QR values, Track records, and local campaigns remain device-local unless the user explicitly exports or shares them. |

## Release-time listing checklist

- [ ] Choose and verify the publisher legal name, public support email, website, and postal details.
- [ ] Complete [Play developer identity verification and package registration](https://support.google.com/googleplay/android-developer/answer/16984799?hl=en) for `com.royal.qrystudio` before Google's September 30, 2026 deadline.
- [ ] If this is a new personal developer account, complete [real Android device verification](https://support.google.com/googleplay/android-developer/answer/14316361?hl=en) in the Play Console mobile app with an eligible, non-rooted physical Android 10+ device.
- [ ] Publish reviewed `/privacy.html`, `/terms.html`, and `/account-deletion.html` at durable HTTPS URLs.
- [ ] Remove every `[RELEASE ...]`, `[PUBLISHER ...]`, and legal-review placeholder from public artifacts.
- [ ] Confirm `VITE_QRY_CLOUD_API_URL` is absent and the release UI offers no account creation, cloud backup, or hosted redirect claim.
- [ ] Configure a production AdMob app and banner unit, publish and verify `app-ads.txt` at the root of the declared developer-website domain, publish the applicable UMP messages and privacy options, and complete publisher/app-readiness verification. Never ship Google test IDs as production inventory.
- [ ] Confirm the launch AAB contains no RevenueCat/Play Billing SDK, billing permission, billing metadata, or active purchase surface.
- [ ] Generate a signed Android App Bundle with a securely backed-up upload key and Play App Signing enabled.
- [ ] Inspect the release AAB's merged manifest, SDK list, permissions, version code/name, target API, signing certificate, and network security behavior.
- [ ] Run automated tests plus physical-device QA on the supported minimum API and a current Android release.
- [ ] Run accessibility checks for 48 dp targets, screen reader labels/order, focus, contrast, font scaling, reduced motion, orientation policy, and keyboard use where relevant.
- [ ] Capture final screenshots from the exact release candidate, then proofread every listing locale.
- [ ] Complete Data safety, Ads, App access, Target audience, Content rating, Advertising ID, and all other App content forms from the release candidate; confirm the Play and AdMob declarations match the adult-only (18+) launch profile.
- [ ] Upload to internal testing, review automated pre-launch reports, resolve policy/security issues, and only then promote.
