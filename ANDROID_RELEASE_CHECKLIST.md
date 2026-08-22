# Android release checklist

## Current verified debug build

- Package: `com.royal.qrystudio`
- App/version: QRYverse `1.0` (`versionCode 1`)
- Android range: API 24 minimum, API 36 target
- Architectures: ARM64, ARMv7, x86, and x86_64
- Output: `android/app/build/outputs/apk/debug/app-debug.apk`
- Signature: valid APK Signature Scheme v2 Android debug certificate
- Expected effective permissions include camera, internet, vibration, network state, Advertising ID, AdServices, wake lock, and foreground service after SDK manifest merging; the launch candidate must not contain Google Play Billing. Inspect the exact candidate again before every upload.
- Deep links: custom-scheme `qry://track` and `qry://go`; no unverified placeholder HTTPS host is claimed
- Packaged assets: production `index.html`, JavaScript chunks, styles, and Capacitor configuration
- Advertising: official Google test App ID/banner unless production environment variables are supplied explicitly

Build and re-run the web checks with:

```powershell
npm run test
npm run lint
npm run server:typecheck -- --noEmit
npm run server:build
npm run build
python scripts/prepare-play-screenshots.py
npm audit --omit=dev
npm run android:local-clean
npm run android:local-verify
```

`android:local-verify` builds `app-debug.apk`, reports Android lint issues, runs the JVM manifest/build-profile contract tests, and compiles `app-debug-androidTest.apk`. The instrumentation suite verifies installed permissions, app metadata, deep-link resolution, bundled release metadata, and packaged legal pages when run on a device or emulator.

The same checks run on pushes to `main` and pull requests through `.github/workflows/ci.yml`. Gradle uses an official distribution checksum, rejects dynamic/changing dependency resolution, and pins the effective Google Mobile Ads and UMP versions; re-run dependency insight on the final release graph before upload.

Install on an attached Android device with USB debugging enabled:

```powershell
.\.tools\android-sdk\platform-tools\adb.exe install -r .\android\app\build\outputs\apk\debug\app-debug.apk
.\.tools\android-sdk\platform-tools\adb.exe install -r .\android\app\build\outputs\apk\androidTest\debug\app-debug-androidTest.apk
.\.tools\android-sdk\platform-tools\adb.exe shell am instrument -w com.royal.qrystudio.test/androidx.test.runner.AndroidJUnitRunner
```

Then run the instrumentation suite and test camera permission grant/denial, live scanning, gallery scanning, QR actions, local persistence after restart, share/export, deep links, UMP, banner placement, Android Back, and rotation. Test at least one API 24-28 device and one current Android device before release.

## Required before Play upload

1. Complete [Google Play developer identity verification and package registration](https://support.google.com/googleplay/android-developer/answer/16984799?hl=en) for `com.royal.qrystudio` before the September 30, 2026 deadline.
2. Create and securely back up a release upload keystore. Never commit it or its passwords.
3. Configure Gradle release signing from local or CI secrets and produce an Android App Bundle (`.aab`). The build now fails closed instead of producing an unsigned release when these variables are absent:

   ```powershell
   $env:QRY_UPLOAD_KEYSTORE = "C:\secure\qryverse-upload.jks"
   $env:QRY_UPLOAD_STORE_PASSWORD = "..."
   $env:QRY_UPLOAD_KEY_ALIAS = "qryverse-upload"
   $env:QRY_UPLOAD_KEY_PASSWORD = "..."
   npm run android:local-bundle
   ```
4. Increase `versionCode` for every Play upload and set the intended public `versionName`.
5. Replace the AdMob test App ID/banner with the production QRYverse IDs, configure UMP messages and `app-ads.txt`, then verify placement and consent on hardware. See `ADMOB_RELEASE_SETUP.md`.
6. Add a controlled HTTPS domain plus Digital Asset Links only if verified public App Links are part of launch; the placeholder host was intentionally removed.
7. Replace every legal/contact/retention placeholder, publish privacy/terms/local-data deletion pages at stable HTTPS URLs, and complete Play Data safety, content rating, app access, target audience, ads, Advertising ID, and store-listing declarations based on the final AAB. The publisher must confirm **18 and over only** in Google Play and compatible AdMob console declarations; because the app has no age gate or reliable user-age signal, keep the SDK child-directed and under-age-of-consent request tags unspecified.
8. Verify the merged launch manifest has no `com.android.vending.BILLING` permission, billing service intent, RevenueCat component, or Play Billing metadata.
9. Upload to Play internal testing, validate UMP, test-account access, and the pre-launch report, then promote through closed/open testing as appropriate.
10. Confirm backup/restore, local-data deletion and clearing, crash handling, TalkBack, 200% font scaling, reduced motion, offline behavior, camera permission paths, and rotation on physical devices.

The `android:local-bundle` command prepares a release bundle, but it is not a substitute for configuring and verifying a private release signing identity.

Subscriptions are intentionally outside the first release. If they are added later, follow `PLAY_BILLING_SETUP.md` and re-run policy, manifest, Data safety, purchase, restore, cancellation, grace-period, expiry, and offline-entitlement verification for that new binary.
