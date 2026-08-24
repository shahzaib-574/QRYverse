# QRYverse resumable release point

Paused: **August 22, 2026**

Resumed: **August 24, 2026**

This checkpoint preserves the active objective: finish QRYverse as a production-ready Google Play release with the reviewed soft-neumorphic UI/UX, accessible navigation and controls, compliant AdMob/UMP integration, browser and Android verification, and an evidence-backed external release handoff.

## State at pause

- The implementation release candidate is committed through `00feabe` and its tracked worktree was clean before this final evidence pass.
- The current debug APK is `android/app/build/outputs/apk/debug/app-debug.apk`, 35,686,576 bytes, SHA-256 `68C96087F601170CE0468E77728621F4DF359E62BE4DA50DE0BDC21BCEF737B9`.
- Browser QA on the exact built bundle passed at 320 px and 1080 px widths. The fresh pause audit found no unnamed visible controls on Home, Create, Library, Track, or Studio; the computed visible text floor at 320 px was 12 px, inputs were 16 px, and there was no horizontal overflow.
- `npm run lint`, `npm test`, web/server builds, the production-dependency audit, Android lint/tests, APK binary audit, API 36 checks, permission allowlist, no-Billing check, four-ABI coverage, and 16 KiB ZIP/ELF checks passed for the debug candidate.
- The production bundle gate was exercised and correctly refused to build while upload signing, non-test AdMob IDs, explicit test-mode disablement, and finalized legal pages are absent.
- `.github/workflows/ci.yml` now retains the exact CI-verified debug artifacts and checksum evidence. `scripts/write-artifact-evidence.ps1` was exercised locally against both debug APKs.
- `docs/PLAY_CONSOLE_SUBMISSION_EVIDENCE.md` and `store-assets/PLAY_ASSET_AUDIT.md` contain the current submission and asset audits.

## External state left untouched

- No production AdMob resource was created. The previously staged form is no longer assumed to be open and must be reverified before any confirmed account action.
- No new commits were pushed to GitHub.
- No Play Console form, listing, release, tester track, or production rollout was created or changed.
- The local browser preview remains available at `http://127.0.0.1:4174/` while its server process remains running.

## Work completed after resume

- Added strict native-resolution screenshot import and Play release-validation gates, exposed as `npm run play:assets:release`.
- Embedded and verified an explicit sRGB ICC profile in the Play icon without changing its decoded pixels.
- Revalidated the browser experience at 320 x 800 and 1080 x 1920 with no horizontal overflow or undersized visible primary controls.
- Reran lint, self-checks, web/server builds, high-severity dependency gates, Android lint/JVM/instrumentation compilation, and the APK binary audit. The debug APK hash remains `68C96087F601170CE0468E77728621F4DF359E62BE4DA50DE0BDC21BCEF737B9`.

## Resume in this order

1. Review the checkpoint diff and rerun `npm run lint`, `npm test`, `npm run play:assets`, and `npm run android:local-verify` if source or dependencies have changed.
2. Replace the provisional screenshots from the exact signed candidate. At least four portrait captures should be 1080 x 1920 or higher; recapture all eight at one native resolution. Fix the empty creator frame, clipped Library scan control, and bottom-navigation composition documented in `store-assets/PLAY_ASSET_AUDIT.md`.
3. Obtain the publisher legal name, public support email, postal address, governing-law/legal-review decisions, stable HTTPS website, and final privacy/terms/local-data URLs. Remove every release placeholder.
4. With explicit owner confirmation, create the staged AdMob unit. Configure production App ID/banner ID, UMP messages/privacy options, maximum ad-content rating, developer website, `app-ads.txt`, app verification, and readiness review.
5. Configure the upload keystore and expected certificate SHA-256, build the signed AAB with test mode explicitly off, and create a private artifact-evidence packet. Never commit credentials or the private key.
6. Audit the exact AAB/Play-generated APKs, run Bundletool and a real 16 KiB device/emulator check, then complete physical-device camera, gallery, consent, ad-placement, rotation, TalkBack, and 200% font-scale QA.
7. Complete Play identity/package registration, Data safety, Ads, Advertising ID, App access, Target audience, IARC, listing, internal/closed testing, pre-launch report, and any account-specific 12-testers/14-days or device-verification gate.
8. Push the local commits only after explicit owner confirmation.

The goal is active but not complete: a signed production AAB, final legal/public URLs, production advertising configuration, signed-device screenshots, Play Console evidence, and hardware testing remain required.
