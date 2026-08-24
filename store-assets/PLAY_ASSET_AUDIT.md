# QRYverse Google Play asset audit

Audit date: 2026-08-22; technical revalidation: 2026-08-24

## Release verdict

The checked-in icon, feature graphic, and eight phone screenshots pass Google Play's basic file-format and dimension gates. The icon now carries an explicit sRGB ICC profile. The screenshots are **not yet the final production upload set**:

- all phone frames are provisional browser captures rather than captures from the signed Android release candidate;
- all eight are 719 x 1278, so they satisfy the ordinary phone screenshot gate but do not satisfy the 1080 x 1920 minimum recommended for screenshot-driven Play recommendation formats;
- `03-create.png` does not show a generated QR code even though its sequence description and alt text describe a live preview;
- `04-library.png` caught the center Scan control during a clipped navigation transition;
- `01-home.png` and `08-studio.png` expose partially obscured content at the fixed bottom-navigation boundary and should be composed more cleanly in the final set.

Do not delete or upscale the current captures. Keep them as provisional evidence and replace the Play Console candidates only after the signed-device recapture described below.

## Authoritative requirements used

- [Add preview assets to showcase your app](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en): icon, feature graphic, screenshot, recommendation-format, composition, and alt-text requirements.
- [Google Play icon design specifications](https://developer.android.com/distribute/google-play/resources/icon-design-specifications?hl=en): 512 x 512, 32-bit PNG, sRGB, full square, no pre-rendered outer shadow or rounded mask, and keyline guidance.
- [Create and set up your app](https://support.google.com/googleplay/android-developer/answer/9859152?hl=en): 30-character app name, 80-character short description, and 4,000-character full description limits.
- [Metadata policy](https://support.google.com/googleplay/android-developer/answer/9898842?hl=en): accurate, relevant metadata without misleading rankings, pricing, badges, or unrelated claims.

Current Play guidance permits up to eight screenshots per supported device type and requires at least two across device types. Ordinary screenshots must be JPEG or 24-bit PNG without alpha, have both dimensions between 320 and 3840 pixels, and have a longest side no more than twice the shortest side. For app recommendation formats that use screenshots, provide at least four portrait screenshots at 1080 x 1920 or higher in 9:16. Alt text should be factual and no longer than 140 characters.

## Exact technical evidence

`npm run play:assets` completed successfully during this audit. Pillow decoded and verified every PNG.

| File | Encoded format | Pixel mode | Dimensions | Bytes | SHA-256 |
| --- | --- | --- | ---: | ---: | --- |
| `qryverse-play-icon-512.png` | PNG | RGBA, 32-bit; alpha range 255-255; sRGB ICC | 512 x 512 | 13,423 | `CE0C7D257D996E21810EE97027CFD89F50DF8624686C92779FA396455135D0E4` |
| `qryverse-feature-graphic-1024x500.png` | PNG | RGB, 24-bit; no alpha | 1024 x 500 | 511,440 | `400FBA2000671410A12B671BC1AA375D47DB5E792AD278C907297C5B9C05B076` |
| `screenshots/01-home.png` | PNG | RGB, 24-bit; no alpha | 719 x 1278 | 313,383 | `9B3DA29C35917BCE79951B375F519710ABF65185E15C8B32EE0FBC4F41737DC5` |
| `screenshots/02-scan-result.png` | PNG | RGB, 24-bit; no alpha | 719 x 1278 | 169,919 | `A6C69A2A431A9FF24D311355F1C28977C4CD97C1B0224C2C595DE03D8B00A46B` |
| `screenshots/03-create.png` | PNG | RGB, 24-bit; no alpha | 719 x 1278 | 195,676 | `7C2C332C20BEA3363C3FBAE4C1B26963846703A68E423CCBDEF737B3DA05F663` |
| `screenshots/04-library.png` | PNG | RGB, 24-bit; no alpha | 719 x 1278 | 170,873 | `82ACA536E4B48E2D0A38650FB6754BBBB3064C3BF5E15FB33D89E0509B376DC6` |
| `screenshots/05-track.png` | PNG | RGB, 24-bit; no alpha | 719 x 1278 | 285,738 | `3B18574FD940AF923617A6CDD8FB69300773ED1EE147381628BE8AE3DCCB1F03` |
| `screenshots/06-record-actions.png` | PNG | RGB, 24-bit; no alpha | 719 x 1278 | 128,999 | `8ED7E4B7737DD03CBE5EBE93A493C7BA74DFFAD5CE8A90C465553A921E85AC0E` |
| `screenshots/07-operations.png` | PNG | RGB, 24-bit; no alpha | 719 x 1278 | 189,009 | `E65698B869E63ABC55B4B4FA56B66165EC9CBF9A23249B59FF2E6912F4D4E62D` |
| `screenshots/08-studio.png` | PNG | RGB, 24-bit; no alpha | 719 x 1278 | 351,313 | `7EF5320FD0BF615249DC3B6EA6B1A7D6E0A2C84349C10C6080F62B1E0592094E` |

The icon is far below Play's 1,024 KB limit. Its solid background is `#173F35`; non-background QR artwork occupies Pillow bounding box `(115, 115, 397, 397)`, centered within the 512-pixel square and comfortably inside the 384-pixel legacy keyline extent. It has no text, ranking badge, pre-rounded outer corners, or outer drop shadow. Although encoded as RGBA as required, every alpha value is opaque. That is appropriate for the full-bleed background.

The Play icon contains an embedded sRGB ICC profile. `npm run play:icon:srgb` added the profile without changing its decoded RGBA pixels; the unchanged pixel SHA-256 is `1A782A997B7EA6CD83481C676A7FB3F7A9E28BD1DCC40FA962ADF5B74C896526`. The feature graphic and provisional screenshots do not carry color-profile metadata; final signed-device captures still require the color-space review in the recapture contract.

The phone ratio is 719:1278 (approximately 9:16), the shortest dimension is 719, and 1278 is less than twice 719. The set therefore passes the ordinary screenshot geometry gate. The shortest dimension is below 1080, so none of the current frames qualifies for the higher-resolution recommendation format.

## Visual and truthfulness review

### Play icon

**Pass.** The solid deep-green field is full bleed, while the cream-and-coral QR mark is centered and restrained. Play can apply its own mask and shadow without double rounding. The checked-in PNG now carries an explicit sRGB ICC profile, and a post-tag visual inspection confirmed the artwork is unchanged.

### Feature graphic

**Pass.** The focal QR/workflow object is central, has ample top and bottom breathing room, and stays away from the raster edges. Peripheral cards and orbit lines are intentionally secondary and can tolerate surface-dependent cropping. The graphic uses the same cream, green, and coral brand language as the app, contains no device frame, Play badge, price, ranking, call to action, or unsupported text claim. The visual metaphors for inventory, workflow, and reporting correspond to features in the current build.

### Phone screenshots

| Frame | Finding | Production action |
| --- | --- | --- |
| `01-home.png` | Core scan entry, permission rationale, quick-create modes, and local activity are truthful. Two identical `example.com` rows and a thin, obscured Track card at the navigation edge reduce polish. | Recapture with two distinct fictional items and either include the Track card cleanly or keep it entirely outside the frame. |
| `02-scan-result.png` | Truthful URL preview, explicit destination, on-device format warning, disclaimer, and user-controlled open/save actions. | Keep this concept; recapture from the signed app after the modal animation is fully settled. |
| `03-create.png` | **Blocking mismatch:** the address is only a placeholder, the preview is an empty QR glyph, and Export/Save are disabled, while the planned caption and alt text claim live QR generation. | Enter a reserved example URL such as `https://example.com/qry-demo`; show the real generated QR and enabled actions. |
| `04-library.png` | Search, filters, local-limit disclosure, favorites, and item actions are truthful. The center Scan control is visibly clipped mid-transition, and duplicate rows weaken the example. | Wait for all navigation animation to settle; show distinct fictional scan/create entries and at least one starred item. |
| `05-track.png` | Truthfully shows one local inventory workspace, record count, local storage boundary, reporting/alert/team/automation entry points, and offline positioning. | Good concept; recapture from the signed app at recommendation resolution. |
| `06-record-actions.png` | Truthfully shows inventory status, quantity, location, quick stock actions, printable label entry, and deletion boundary. | Good concept; use fictional data and wait for sheet animation/blur to settle. |
| `07-operations.png` | Truthfully labels the summary as device-local and discloses the PDF script limitation while showing available CSV/PDF exports. | Good concept; recapture with a richer but still legible fictional dataset if desired. |
| `08-studio.png` | Local campaigns, local scan counts, QR colors, local team staging, backup controls, and the app-routed campaign boundary match the build. A content row peeks out beneath the fixed navigation. | Recapture with enough bottom inset or a cleaner scroll position so underlying content does not leak below the navigation surface. |

All eight screenshots use the actual UI without marketing overlays, device frames, browser chrome, notifications, ranking claims, prices, or install calls to action. However, the wide pale side gutters make the in-app surface occupy only roughly three quarters of each browser raster's width, which reduces thumbnail legibility. A real phone capture at 1080 x 1920 or higher should let the UI fill the intended phone viewport.

## Listing-copy audit

| Field | Measured length | Limit | Finding |
| --- | ---: | ---: | --- |
| App name: `QRYverse: QR & Track` | 20 | 30 | Pass; descriptive, branded, and free of ranking/price claims. |
| Short description | 70 | 80 | Pass; accurate and free of calls to action. `and more` is vague but not misleading. A clearer 68-character option is: `Scan, create and organize QR codes, then track assets and inventory.` |
| Full description | 2,182 | 4,000 | Pass on length and verified feature substance. |

The full-description claims were checked against `src/App.tsx`, `src/lib/qr.ts`, `src/track/Track.tsx`, `src/business/DynamicStudio.tsx`, `src/business/BusinessSheets.tsx`, and `src/business/reports.ts`. Camera and gallery scanning, link previews, supported payload types, on-device safety hints, four creator modes, local Library/favorites, Track workflows, evidence, CSV/PDF/backup exports, printable labels, local campaigns, local scan counts, and explicit webhook tests all have corresponding implemented surfaces. The copy also states the material limits: local-first v1, no account/cloud connection, user-initiated external actions, safety hints rather than antivirus, ads, and no purchases.

All proposed alt descriptions are 81-91 characters, under Google's 140-character recommendation. They are factual except that the `03-create.png` alt text becomes accurate only after the required generated-code recapture.

The listing remains externally incomplete because its privacy-policy and account-deletion URLs still contain `[RELEASE PUBLIC HTTPS URL]`. The publisher support identity/contact fields, production URL availability, final Console declarations, and locale proofreading must be completed before submission. These are listing blockers even though the image files themselves decode successfully.

## Signed-device recapture contract

1. Install the exact signed release candidate that will be uploaded to Play; record its version code/name, package, signing certificate SHA-256, and build artifact SHA-256 with the capture set.
2. Capture portrait images directly from the Android app at 9:16 and at least 1080 x 1920. Capture all eight at one device resolution rather than upscaling these 719 x 1278 files.
3. Use a consistent light theme, display scale, font scale, orientation, status-bar treatment, dataset, and clock. Clear notifications and ensure system battery/Wi-Fi/cellular indicators are complete if the status bar is visible.
4. Wait for route, sheet, QR-rendering, and navigation animations to finish. Verify there is no clipped FAB, transient toast, permission dialog, loading skeleton, keyboard, debug overlay, or content leaking under the bottom bar.
5. Use only plausible fictional values and reserved domains. Do not expose personal accounts, real contact details, private QR payloads, production secrets, or test account email addresses.
6. Do not include test ads. Also inspect each frame for third-party ad creative, trademarks, or misleading empty ad space before selecting it for the listing.
7. Stage the new files separately until review is complete. Validate actual encoding, RGB/no-alpha mode, exact dimensions, aspect ratio, corruption, file size, and sRGB color space; then compare every frame against the exact release build and its alt text.
8. Review thumbnails at small Play-card size and center-crop previews. Keep core UI and any meaningful text away from cutoff zones. Retain at least four strongest actual-UI frames as the first four screenshots.

Recommended first-four order after recapture: Home, safe result preview, generated QR creator, and populated Track workspace. Library, record actions, operations, and Studio can follow.

## Validator coverage note

The default `prepare-play-screenshots.py` validation checks decodability, encoded PNG format, the icon byte ceiling, exact icon/feature sizes, screenshot set completeness, RGB/RGBA modes, screenshot geometry, and consistent screenshot dimensions. Its `--release` mode additionally requires recommendation-resolution portrait screenshots and explicit sRGB/ICC metadata on the Play icon. The importer accepts native PNG or JPEG captures and has a matching `--release` resolution gate. Neither script can prove that pixels were captured natively rather than upscaled, or verify safe-zone composition, animation settlement, actual signed-build provenance, feature truthfulness, alt-text agreement, or status-bar hygiene; those items still require the manual and signed-device checks above.
