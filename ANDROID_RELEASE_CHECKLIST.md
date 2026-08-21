# Android release checklist

## Current verified debug build

- Package: `com.royal.qrystudio`
- App/version: QRY `1.0` (`versionCode 1`)
- Android range: API 24 minimum, API 36 target
- Architectures: ARM64, ARMv7, x86, and x86_64
- Output: `android/app/build/outputs/apk/debug/app-debug.apk`
- Signature: valid APK Signature Scheme v2 Android debug certificate
- Effective permissions: camera, internet, vibration, network state, and Google Play Billing
- Deep links: `qry://track`, `qry://go`, `https://app.qry.local/track/*`, and `https://app.qry.local/go/*`
- Packaged assets: production `index.html`, JavaScript chunks, styles, and Capacitor configuration

Build and re-run the web checks with:

```powershell
npm run test
npm run lint
npm run android:local-debug
```

Install on an attached Android device with USB debugging enabled:

```powershell
.\.tools\android-sdk\platform-tools\adb.exe install -r .\android\app\build\outputs\apk\debug\app-debug.apk
```

Then test camera permission grant/denial, live scanning, gallery scanning, QR actions, local persistence after restart, share/export, deep links, and the purchase/restore UI. Test at least one API 24-28 device and one current Android device before release.

## Required before Play upload

1. Create and securely back up a release upload keystore. Never commit it or its passwords.
2. Configure Gradle release signing from local or CI secrets and produce an Android App Bundle (`.aab`).
3. Increase `versionCode` for every Play upload and set the intended public `versionName`.
4. Create the subscription products and entitlement in Google Play Console and RevenueCat; add only the public Android RevenueCat SDK key to the build environment.
5. Replace `app.qry.local` with a controlled HTTPS domain, host Digital Asset Links, and enable verified App Links if public web links are part of launch.
6. Publish a privacy policy and complete Play Data safety, content rating, app access, target audience, ads, and store-listing declarations based on the final behavior.
7. Upload to Play internal testing, validate purchase, restore, cancellation/expiry handling, and test-account access, then promote through closed/open testing as appropriate.
8. Confirm backup/restore, account deletion or local-data erasure wording, crash handling, accessibility, and offline behavior on physical devices.

The `android:local-bundle` command prepares a release bundle, but it is not a substitute for configuring and verifying a private release signing identity.
