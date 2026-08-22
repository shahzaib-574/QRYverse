# QRYverse AdMob release setup

Android app advertising is configured through **Google AdMob**. AdSense is the underlying publisher/payment relationship and is not the SDK or app-registration surface.

## Implemented in the app

- `@capacitor-community/admob` 8.1.0 for Capacitor 8.
- UMP consent information refresh on every native Android launch.
- Consent form display when required and an in-app privacy-options entry when UMP requires it.
- Google `G` maximum ad-content rating. The intended Play launch audience is **adults ages 18 and older only**. Because the app has no age gate and does not know a user's age, child-directed and under-age-of-consent request tags remain unspecified. The publisher must confirm the matching Play and AdMob console declarations and complete the AdMob policy review before release.
- One adaptive banner reserved for free users on Home and Library only.
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
npm run android:sync
```

The Gradle build deliberately falls back to Google's test App ID, and the client deliberately stays in test mode unless `VITE_ADMOB_TEST_MODE=false` is explicit. A production verification must fail the release if either test ID remains in the merged manifest or web assets.

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
- Confirm the banner appears only on Home and Library, remains above navigation and safe-area insets, disappears on every excluded screen, and is removed for Pro.
- Inspect the merged release manifest and captured network traffic. Expected SDK-merged permissions can include Advertising ID, AdServices, network state, foreground service, and wake lock. Play Billing and `com.android.vending.BILLING` must be absent from the v1 artifact.
- Use test IDs and test devices for all pre-release QA. Switch to live IDs only for the signed internal-testing candidate.

Primary references:

- Plugin: https://github.com/capacitor-community/admob
- UMP privacy flow: https://developers.google.com/admob/android/privacy
- Android test ads: https://developers.google.com/admob/android/test-ads
- app-ads.txt: https://support.google.com/admob/answer/9363762
