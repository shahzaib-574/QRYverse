# QRYverse Play Console submission evidence

Audit date: **August 22, 2026**

Audited application revision: `00feabe`; release evidence revalidated August 24, 2026

Package: `com.royal.qrystudio`

Intended first release: QRYverse `1.0` (`versionCode 1`), English (United States), Productivity, free with ads, no account, no billing, cloud off, adults 18 and older only.

This is an evidence index and release gate, not a statement that Play Console submission is complete. Console state, account status, legal identity, production credentials, and a signed production bundle are not reproducible from the repository. Treat every **External blocker** or **Final-artifact proof pending** item below as unresolved until the named evidence is attached.

## Status definitions

- **Proven in repository**: current source or a reproducible local artifact directly proves the requirement.
- **Final-artifact proof pending**: source/debug evidence is good, but only the exact signed AAB or Play-generated APKs can close the gate.
- **External blocker**: requires publisher facts, a public URL, Play/AdMob state, testing, or legal review not present in the repository.
- **Replace before upload**: the checked-in artifact is provisional and must not be used as the final submission artifact.

## Submission decision

**Not ready to send for production review.** The codebase has strong release guards and its current debug APK passes the API 36, permission, signing, ABI, and 16 KiB binary checks. Production submission is still blocked by the absent signed AAB, unresolved/published legal pages, production AdMob and UMP configuration, Play Console declarations, IARC rating, account/package verification, test-track evidence, physical-device QA, and final screenshots.

## Observed Play Console state

Read-only verification on **August 24, 2026** established that the selected developer account is a personal account with two other apps already in production. Its contact fields are verified and a developer website is configured, but those existing publisher details have not been approved for reuse in QRYverse's public legal pages. QRYverse is not yet an app in the account, and `com.royal.qrystudio` is not among the registered package names. The Create App form confirms that the package is available and is staged with the repository's intended choices: `QRYverse: QR & Track`, English (United States), App, Free, and Play automatic protection enabled. The Developer Program Policy and US export-law declarations remain unchecked, and **Create app has not been pressed**.

## Requirement-by-requirement evidence matrix

| Requirement | Current QRYverse evidence | Status | Exact closure evidence |
| --- | --- | --- | --- |
| App name, short description, and full description limits | `GOOGLE_PLAY_LISTING.md` contains a 20-character name, 70-character short description, and 2,182-character full description. Current Play limits are 30, 80, and 4,000 characters respectively. Copy accurately describes the cloud-off, ad-supported profile and avoids ranking/price claims. | **Proven in repository; Console entry pending** | Screenshot/export of the en-US Main store listing after the text is entered and proofread. |
| Store icon | `store-assets/qryverse-play-icon-512.png` validates as a 512 × 512 RGBA PNG with an embedded sRGB ICC profile and is 13,423 bytes, below Play's 1,024 KB limit. Profile tagging preserved the exact decoded pixels. | **Proven in repository; Console upload pending** | Main store listing shows the exact checked-in icon with SHA-256 `CE0C7D257D996E21810EE97027CFD89F50DF8624686C92779FA396455135D0E4`. |
| Feature graphic | `store-assets/qryverse-feature-graphic-1024x500.png` validates as 1024 × 500 24-bit RGB PNG. Its central abstract QR composition has no price, rank, Play badge, or unsupported textual claim. | **Proven in repository; Console upload pending** | Main store listing shows the exact checked-in graphic and its final alt text. |
| Phone screenshot technical rules | Eight checked-in files validate as 719 × 1278 24-bit RGB PNGs without alpha. They satisfy Play's minimum two screenshots, 320–3840 px dimension range, and 2:1 maximum-dimension ratio. | **Proven only for mandatory file constraints** | Run `npm run play:assets:release` against the final signed-device set and attach its output. |
| Phone screenshot truthfulness and quality | The set is explicitly documented as provisional browser capture. `03-create.png` shows an empty placeholder and disabled actions, not the planned live generated QR state. `04-library.png` visibly clips the app navigation. The 719 px width also misses Play's recommendation-surface threshold of at least four 1080 × 1920 portrait screenshots. | **Replace before upload** | Capture all final frames from the exact signed candidate with fictional data and no test ads/debug UI. Recapture at least four at 1080 × 1920 or higher rather than upscaling. Verify `03` shows a generated code and enabled action, `04` shows the complete viewport/navigation, and no important UI is obscured by the bottom bar. Add factual alt text of 140 characters or fewer in Console. |
| Android App Bundle and version | Source declares package `com.royal.qrystudio`, version `1.0`/`1`. Only debug APKs exist under `android/app/build/outputs`; no production `.aab` is present. The Gradle release gate requires owner signing secrets, production AdMob IDs, cloud-off assets, and resolved legal pages. | **External blocker / Final-artifact proof pending** | Signed production AAB, upload-certificate SHA-256, bundle SHA-256, Play App Signing enrollment, and App Bundle Explorer inspection. Increment `versionCode` for any later upload. |
| Target API | `android/variables.gradle` sets `compileSdkVersion = 36` and `targetSdkVersion = 36`. The current debug APK independently reports compile/target API 36 through `npm run android:audit-debug`. This meets the Android 16/API 36 rule taking effect August 31, 2026. | **Proven in source/debug; Final-artifact proof pending** | App Bundle Explorer for the exact production AAB reports target API 36. |
| 16 KiB page-size compatibility | The current debug APK passes 16 KiB ZIP-offset checks and every ARM64/x86_64 ELF `PT_LOAD` segment has 0x4000-or-greater power-of-two alignment with congruent offsets. Google currently says API 35+ apps on Play must support 16 KiB page sizes and unsupported app updates cannot be released starting February 1, 2027. | **Proven for debug; Final-artifact/device proof pending** | Bundletool reports `PAGE_ALIGNMENT_16K` for the signed AAB; audit a universal APK generated from that exact bundle; confirm no Play Console compatibility warning; install and exercise camera/gallery scanning on a real or emulated 16 KiB environment where `adb shell getconf PAGE_SIZE` returns `16384`. |
| Permission and billing boundary | The audited debug APK has exactly the repository's reviewed 11-permission allowlist, including Camera, Internet, network state, vibration, Advertising ID/AdServices, wake lock, foreground service, and the package receiver permission. Google Play Billing is absent. | **Proven for debug; Final-artifact proof pending** | App Bundle Explorer and the production binary audit show the same reviewed permissions and no `com.android.vending.BILLING`, billing components, or billing metadata. |
| Ads declaration | QRYverse integrates Google Mobile Ads and reserves one adaptive banner on Home/Library. The correct Play answer is **Yes, contains ads**; Play explicitly includes third-party banner SDKs in this declaration. The debug build intentionally uses Google's test IDs. | **Draft answer proven; External blocker** | Submit Ads = Yes in App content. Production AAB must contain the production QRYverse App ID/banner ID, test mode off, no test devices/debug geography, and must pass on-device placement/consent tests. |
| Advertising ID declaration | The current merged debug APK contains `com.google.android.gms.permission.AD_ID`; Google notes that Mobile Ads can merge this permission automatically. Google's current Mobile Ads 25.4.0 disclosure says it collects device/account identifiers for advertising, analytics, and fraud prevention. | **Draft answer proven; Final-artifact/Console proof pending** | If the final AAB still contains `AD_ID` as expected, declare **Yes, the app uses Advertising ID**, with the purposes **Advertising or marketing**, **Analytics**, and **Fraud prevention, security and compliance**. Confirm all active artifacts and the Console declaration agree. |
| Data safety form | `PLAY_DATA_SAFETY.md` is scoped to the exact ad-enabled, cloud-off release. It accounts for Google Mobile Ads 25.4.0 and ML Kit barcode scanning, including auto-zoom. Google requires SDK activity in the form and holds the publisher responsible for accuracy. | **Strong draft; External blocker** | From the signed candidate and observed traffic, submit **Yes** to collection/sharing. At minimum reconcile Approximate location (IP-derived), App interactions, Diagnostics, and Device or other IDs; reflect Mobile Ads' automatic collection/sharing and ML Kit's diagnostic/usage collection. Save the submitted form/export, date, SDK versions, and traffic capture. Decide the deletion-request answer only after the production support process and Google/vendor controls are documented; local deletion alone does not prove deletion of off-device SDK data. |
| Encryption statement | Android cleartext traffic is disabled. Google states Mobile Ads 25.4.0 uses TLS and ML Kit encrypts its documented collection in transit with HTTPS. | **Source/vendor evidence; Final traffic proof pending** | Capture signed-candidate traffic for first launch, consent choices, privacy options, ad request, live auto-zoom scan, and gallery scan; investigate any non-TLS destination before answering that all collected data is encrypted in transit. |
| Privacy policy | `public/privacy.html` is clearly labeled and covers QRYverse, local data, Mobile Ads/UMP, ML Kit, retention/deletion, security, and providers. It still says `Version 1.0 draft`, contains release-owner and legal placeholders, lacks the final publisher identity/contact, and is not proven at a public URL. | **External blocker** | Legal review; replace every placeholder; identify the same app/publisher entity used in Play; publish static HTML at an active, publicly accessible, non-geofenced, non-editable HTTPS URL (not PDF, not login-protected); confirm it renders in a standard browser without relying on authentication or special handlers; link it both in-app and in Play Console. Record URL, HTTP 200 check, review date, and policy version. |
| Account deletion declaration | The cloud-off v1 binary offers no account creation, so Play's account-deletion URL requirement is not applicable. `public/account-deletion.html` correctly describes local-data clearing but is still a draft with contact placeholders. | **Draft proven; External publishing pending** | Confirm the signed release has no account creation. Do not mislabel the local-data page as an account-deletion service. Publish it as support guidance after placeholders and device steps are verified. Reassess immediately if Cloud/accounts are ever enabled. |
| App access | The release profile and packaged build profile say cloud off and no sign-in. All launch functionality is available without credentials; camera permission is an ordinary runtime permission, not special reviewer access. | **Draft answer proven; Console proof pending** | In App content, select that all functionality is available without special access/sign-in. Reviewer note: launch directly; Home offers Paste and gallery flows even if camera is denied; Studio shows Cloud unavailable in this release. Recheck the signed candidate before submission. |
| Target audience | The launch profile, listing, and privacy draft consistently specify adults ages 18 and older only. | **Draft answer; External blocker** | Select only Play's adult age groups (18 and over), ensure no child-directed merchandising, and keep Play/AdMob declarations consistent. Because the app has no reliable user-age signal, do not falsely assert a known child's/adult's status in SDK request tags. |
| Content rating | No IARC certificate or submitted questionnaire is present. The app can parse user-provided QR content and open user-selected destinations in external apps/browser, and it contains ads; these facts must be answered truthfully. | **External blocker** | Submit the current IARC questionnaire after Ads and App access. Archive the questionnaire answers, certificate ID, territorial ratings, and date. Configure AdMob's maximum ad-content rating no higher than the app's assigned rating and review sensitive-category/blocking controls; Play treats served ads as part of the app's rating compliance. |
| Other App content declarations | Repository drafts say News = No, Health = No, Financial features = No, Government = No, COVID-19 = No, no purchases, and no public social/UGC service. | **Draft answers; Console proof pending** | Review the exact Console wording against the signed binary and submit each applicable declaration. Archive the submission summary/screenshots. |
| Internal/closed testing and pre-launch report | No Play test-track or pre-launch report evidence is stored in the repository. Internal testing is recommended and supports up to 100 testers; it does not satisfy the conditional new-personal-account production gate. | **External blocker** | Upload the signed AAB to internal testing, verify install/upgrade and production UMP/ad behavior, collect the pre-launch report, resolve warnings, then use the required closed track if the account rule applies. |
| New personal account closed-test gate | The selected developer account is confirmed personal and already has two production apps. Its creation date and whether production access automatically covers this new app remain unproven. For personal accounts created after November 13, 2023, Google requires at least 12 testers continuously opted into a closed test for the preceding 14 days, followed by a production-access application. | **External blocker if applicable** | After QRYverse is created, inspect its production-access state. If the gate appears, preserve the closed-track name, opt-in URL, 12+ continuously opted-in tester evidence, start/end timestamps, feedback summary, changes made, and production-access approval. |
| New personal account device verification | The account is confirmed personal and has existing production apps, but no explicit QRYverse/device-verification result is available before app creation. New personal accounts can be required to verify access to a non-rooted physical Android device running Android 10 or later using the Play Console mobile app. | **External blocker if applicable** | Inspect the QRYverse/account task after creation and retain account-owner evidence if device verification is required. |
| Developer identity and package registration | Play Console contains the account identity and verified contact fields. Android developer verification currently lists two other registered packages; `com.royal.qrystudio` is available but not registered, and QRYverse has not been created. Google says all Play package names must be registered by September 30, 2026. | **External blocker; time-sensitive** | The owner must affirm the policy/export declarations and authorize Create App. Confirm that creation registers `com.royal.qrystudio`, then save the package status and applicable certificate details before September 30, 2026. |
| AdMob ownership/readiness | Read-only Console verification on August 24, 2026 showed an open, approved publisher account with no current Policy center issues and an existing QRYverse Android app. The publisher ID was verified directly and `public/app-ads.txt` now contains its exact authorized-seller line. QRYverse itself has no ad unit or store details and remains **Requires review**. No European/US privacy message exists; the inherited maximum ad-content rating is MA while the documented G override is only staged. | **External blocker** | With explicit owner confirmation, create the staged banner and save the G override; create and publish the applicable privacy messages. Publish the checked-in `app-ads.txt` at the approved developer-website root, link the Play listing, verify HTTP 200/crawlability and Authorized status, request/complete app review, and record Ready status. |

## Console answer sheet for the current v1 profile

These are candidate answers, not permission to submit a form without checking the exact signed AAB and current Console wording.

| Console item | Candidate answer |
| --- | --- |
| Contains ads | **Yes** |
| App access/sign-in details | **All functionality is available without special access**; no credentials |
| In-app purchases | **No** |
| Advertising ID | **Yes**, if the final merged manifest matches the current candidate; purposes: advertising/marketing, analytics, fraud prevention/security/compliance |
| Data safety collects or shares data | **Yes** |
| Account creation | **No** |
| Account deletion URL | **Not applicable** to v1; local-data clearing page is support guidance only |
| Target audience | **Adults 18 and older only** |
| News or magazine | **No** |
| Health | **No health features** |
| Financial features | **No financial product/transaction functionality** |
| Government | **No** |
| COVID-19 contact tracing/status | **No** |
| Content rating | **Do not preselect from this document**; complete IARC from actual content and ads, then archive the certificate |

## Required evidence packet before production submission

Create a private release record outside the public repository containing:

1. Publisher account type, creation date, verified legal identity, support email, postal details, and September 2026 package-registration status.
2. Production AAB filename, SHA-256, version code/name, upload-certificate SHA-256, Play App Signing state, dependency/SDK list, merged manifest, and App Bundle Explorer screenshots.
3. Bundletool 16 KiB result, audited universal APK result, Play compatibility result, and live 16 KiB device/emulator result.
4. Published privacy, terms, and local-data support URLs with HTTP 200/global-access checks, legal approval, effective dates, and screenshot/HTML archive.
5. Data safety submission export and the signed-candidate traffic/dependency evidence used for every answer.
6. Ads, Advertising ID, App access, Target audience, IARC, and every other App content submission receipt or screenshot.
7. Production AdMob App ID/banner ID mapping (keep secrets out of Git), UMP message/privacy-options status, maximum ad-content rating, blocking-control review, developer website, app-ads.txt verification, and app-readiness status.
8. Final en-US listing export plus checksums of the exact icon, feature graphic, and replacement screenshot files uploaded to Play.
9. Internal/closed track releases, tester/device matrix, camera/gallery/consent/ad/accessibility results, pre-launch report, tester feedback and fixes, and production-access approval when applicable.

## Reproducible checks run in this audit

```powershell
npm run play:assets
npm run android:audit-debug
Get-FileHash android/app/build/outputs/apk/debug/app-debug.apk -Algorithm SHA256
```

Results on August 22, 2026:

- All canonical image files passed format/dimension validation.
- Debug APK SHA-256: `68C96087F601170CE0468E77728621F4DF359E62BE4DA50DE0BDC21BCEF737B9`.
- Debug APK audit passed package, API 36, version, signature, exact permission allowlist, no Billing, four ABI partners, uncompressed native libraries, 16 KiB ZIP offsets and 64-bit ELF alignment, production-mode/cloud-off web profile, and reviewed debug AdMob/UMP safeguards.
- These results do **not** substitute for production AAB, Console, legal, network, or device evidence.

## Official primary sources checked

Links were opened and checked against the live official pages on August 22, 2026.

- [Create and set up your app — metadata limits and Android App Bundles](https://support.google.com/googleplay/android-developer/answer/9859152?hl=en)
- [Add preview assets to showcase your app — icon, feature graphic, screenshots, alt text](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en)
- [Target API level requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)
- [Support 16 KiB page sizes](https://developer.android.com/guide/practices/page-sizes)
- [Prepare your app for review — privacy, ads, access, audience, ratings](https://support.google.com/googleplay/android-developer/answer/9859455?hl=en)
- [User Data policy — Data safety and privacy-policy requirements](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en)
- [Provide information for the Data safety section](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)
- [Advertising ID](https://support.google.com/googleplay/android-developer/answer/6048248?hl=en)
- [Content rating requirements](https://support.google.com/googleplay/android-developer/answer/9859655?hl=en)
- [Manage target audience and app content](https://support.google.com/googleplay/android-developer/answer/9867159?hl=en)
- [Set up internal, closed, or open testing](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en)
- [Testing requirements for new personal accounts](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [Device verification for new developer accounts](https://support.google.com/googleplay/android-developer/answer/14316361?hl=en)
- [Registering Play package names](https://support.google.com/googleplay/android-developer/answer/16984799?hl=en)
- [Google Mobile Ads 25.4.0 Play data disclosure](https://developers.google.com/admob/android/privacy/play-data-disclosure)
- [ML Kit Android data disclosure](https://developers.google.com/ml-kit/android-data-disclosure)
- [UMP setup and consent request gating](https://developers.google.com/admob/android/privacy)
- [Google Play Ads policy](https://support.google.com/googleplay/android-developer/answer/9857753?hl=en)
- [AdMob maximum ad-content rating](https://support.google.com/admob/answer/7562142?hl=en)
- [Set up app-ads.txt](https://support.google.com/admob/answer/9363762?hl=en)
- [AdMob app verification and app readiness](https://support.google.com/admob/answer/14538460?hl=en)
