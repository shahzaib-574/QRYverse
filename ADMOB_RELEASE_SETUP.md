# QRYverse AdMob release setup

Android app advertising is configured through **Google AdMob**. AdSense is the underlying publisher/payment relationship and is not the SDK or app-registration surface.

## Implemented in the app

- `@capacitor-community/admob` 8.1.0 for Capacitor 8.
- The dependency is pinned to 8.1.0 and receives a repository-owned, source-shape-checked Android patch during `npm install` and `android:sync`. The patch scopes API 35+ window insets to the banner container and makes native banner removal/update promises settle only after their UI-thread work, preventing the [upstream rotation overlay](https://github.com/capacitor-community/admob/issues/427) and resize/removal race. `npm test` fails if the reviewed patch is absent or the dependency changes shape; review and replace the patch when upgrading the plugin.
- UMP consent information refresh on every native Android launch.
- Consent form display when required and an in-app **Privacy and cookie settings** entry when UMP requires it, using Google's recommended revocation-link wording.
- Consent-status/message requests may contact UMP before an ad request is permitted; actual ad requests remain gated by `canRequestAds`.
- Google `G` maximum ad-content rating. The intended Play launch audience is **adults ages 18 and older only**. Because the app has no age gate and does not know a user's age, child-directed and under-age-of-consent request tags remain unspecified. The publisher must confirm the matching Play and AdMob console declarations and complete the AdMob policy review before release.
- One adaptive banner reserved for free users on Home and Library only.
- A fixed neutral rail separates the native banner from scrolling content and dynamically clears the raised Scan control, navigation, and system inset.
- Route changes and app backgrounding pause/resume the existing banner; failed or geometry-invalidated loads cannot issue another request inside 60 seconds.
- No ad on the camera, scan result, editor, Track action, account, consent, purchase, or deletion surfaces.
- No launch interstitial, rewarded gate, purchase prompt, or accidental-click placement is included.
- Browser builds are ad-free.

Development defaults to Google's official Android test app and adaptive-banner IDs. Never click a live ad during testing.

## Production IDs

Create one Android app and one banner ad unit in AdMob, then supply public configuration at build time:

```powershell
$env:QRY_ADMOB_APP_ID = "ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY"
$env:VITE_ADMOB_BANNER_ID = "ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ"
$env:VITE_ADMOB_TEST_MODE = "false"
$env:VITE_ADMOB_TEST_DEVICE_IDS = ""
$env:VITE_ADMOB_CONSENT_DEBUG_GEOGRAPHY = "DISABLED"
npm run android:sync
```

The Gradle build deliberately falls back to Google's test App ID, and the client deliberately stays in test mode unless `VITE_ADMOB_TEST_MODE=false` is explicit. A production verification must fail the release if either test ID remains in the merged manifest or web assets.

For UMP QA only, register the hashed Android device ID, keep test mode enabled, and set `VITE_ADMOB_CONSENT_DEBUG_GEOGRAPHY` to `EEA`, `US`, `OTHER`, or `DISABLED`. Geography forcing is ignored unless `VITE_ADMOB_TEST_DEVICE_IDS` contains at least one ID. Production builds must leave the device list empty and use `DISABLED`.

## Console checklist

1. Link the exact Play listing after it exists and resolve AdMob's app-readiness review.
2. Create and publish the applicable European regulations, US state regulations, and IDFA messages in **Privacy & messaging**. QRYverse is Android-only today, so IDFA is relevant only if an iOS build is added.
3. Confirm the Google Play Target audience as **18 and over only** and make the AdMob audience/treatment declarations consistent with that adult-only launch. Do not set child-directed or under-age-of-consent request tags without an age gate or another reliable user-age signal.
4. Add the public developer website to the Play listing and publish a real `app-ads.txt` at its domain root.
5. Replace `public/app-ads.txt.example` with the exact AdMob-authorized-seller line from the account and verify it in AdMob.
6. Complete Play's Ads, Advertising ID, Data safety, Target audience, Content rating, and Families declarations from the exact production AAB.

## Release tests

- Run UMP test geography on a registered test device for consent required, consent declined, consent accepted, and privacy-options reopening.
- Confirm no ad request is made before `canRequestAds` is true.
- Confirm the banner appears only on Home and Library, occupies the fixed neutral rail, remains clear of scrolling content/navigation/safe-area insets, disappears on every excluded screen, pauses while backgrounded, and is removed for Pro.
- Confirm Home/Library route round trips resume the existing banner, failed loads clear the rail, and no app-driven replacement/retry occurs inside 60 seconds.
- On Android 15 and 16, rotate repeatedly with the banner visible and while moving between compact bottom navigation and expanded navigation rail. Confirm no system-bar scrim remains, the banner is recreated at the correct margin, and every later hide/resume/remove still completes.
- Inspect the merged release manifest and captured network traffic. Expected SDK-merged permissions can include Advertising ID, AdServices, network state, foreground service, and wake lock. Play Billing and `com.android.vending.BILLING` must be absent from the v1 artifact.
- Use test IDs and test devices for all pre-release QA. Switch to live IDs only for the signed internal-testing candidate.

Primary references:

- Plugin: https://github.com/capacitor-community/admob
- UMP privacy flow: https://developers.google.com/admob/android/privacy
- UMP revocation link: https://support.google.com/admob/answer/12226986
- Android test ads: https://developers.google.com/admob/android/test-ads
- app-ads.txt: https://support.google.com/admob/answer/9363762
