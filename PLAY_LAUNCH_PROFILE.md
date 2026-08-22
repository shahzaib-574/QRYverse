# QRYverse Google Play launch profile

This is the exact product boundary for Android version `1.0` (`versionCode 1`, package `com.royal.qrystudio`). Release copy, policy declarations, screenshots, traffic tests, and the signed AAB must all match it.

## Included

- English-only, local-first QR scanning, gallery recognition, safety preview, static creation, library, Track workspaces, imports, exports, labels, reports, local campaigns, themes, and privacy-scrubbed local diagnostics.
- Free, ad-supported distribution using Google Mobile Ads and UMP. One adaptive banner may appear on Home or Library only after the SDK reports that ads may be requested.
- Camera, gallery, share, and export actions happen only after a visible user action. Track persistence is committed before success is shown and is guarded at 3 MiB to avoid silent WebView quota loss.

## Deliberately disabled

- No account creation, login, cloud backup, hosted redirect, public dynamic-campaign analytics, or production QRYverse server connection. `VITE_QRY_CLOUD_API_URL` must be unset; the release Gradle guard rejects a cloud-enabled AAB.
- No RevenueCat, Google Play Billing, subscription products, purchase UI, billing permission, or paid quotas.
- No public HTTPS App Links; only the private `qry://track` and `qry://go` app schemes are registered.
- No Urdu/RTL claim. Translation groundwork remains source-only until the full product surface and device QA are complete.

## Console declarations

- Contains ads: **Yes**.
- In-app purchases: **No**.
- App access: **All launch functionality is available without sign-in**.
- Account creation/deletion requirement: **Not applicable to this binary**; it creates no account. Publish the local-data deletion instructions as a support resource.
- Target audience: **adults ages 18 and older only**. The publisher must confirm the matching Google Play Target audience selection and AdMob console declarations before release. Because the app has no age gate and does not know a user's age, the SDK child-directed and under-age-of-consent request tags remain unspecified rather than asserting a known user status.
- Data safety: file from the ad-enabled, cloud-off candidate and current Google Mobile Ads/ML Kit disclosures; do not copy the future-cloud worksheet assumptions.

## Release invariant

A candidate is not this profile if it includes a cloud endpoint, billing integration, Google test ad ID, unavailable feature claim, partial-language claim, or screenshots from another build. Any such change requires new policy, traffic, store-copy, and device review before upload.
