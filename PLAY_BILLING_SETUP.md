# Deferred Google Play subscription activation

The first QRYverse Play release is intentionally ad-supported and does **not** bundle RevenueCat, Google Play Billing, or the billing permission. `src/lib/billing.ts` is a small inert adapter that keeps the Studio UI in a truthful “plans unavailable” state. This document is a future opt-in migration plan, not a launch requirement.

Adding purchases changes the production binary, privacy behavior, Play Console declarations, legal terms, test matrix, and support obligations. Do not activate it only by adding an API key.

## 1. Configure products

1. Create the Android app in Google Play Console using package ID `com.royal.qrystudio`.
2. Upload a signed internal-testing bundle.
3. Create monthly and annual subscription products for QRY Track Pro.
4. Add test accounts under license testing.

## 2. Add and configure RevenueCat in a dedicated billing release

1. Create a release branch and install a current, Play-policy-compatible `@revenuecat/purchases-capacitor` version.
2. Run `npx cap sync android`, then inspect the complete dependency graph and merged manifest rather than assuming the SDK adds only Billing.
3. Create a RevenueCat project and Android app for the same package ID.
4. Connect its Google Play service credentials, import the Play products, create entitlement `track_pro`, and attach the products to the current offering.
5. Replace only the inert implementation in `src/lib/billing.ts`; preserve its `BillingSnapshot`, `initializeBilling`, `purchasePlan`, and `restoreBilling` interface so `App.tsx` does not need architectural changes.

## 3. Configure the billing release environment

Add the public, app-specific Android SDK key to an uncommitted `.env.production.local` file. Do not add these variables to the ad-supported launch environment:

```dotenv
VITE_REVENUECAT_ANDROID_API_KEY=goog_your_public_sdk_key
VITE_REVENUECAT_ENTITLEMENT_ID=track_pro
```

Do not use a RevenueCat secret key or Google service-account key in a Vite environment variable.

## 4. Verify

Build from a machine with Android Studio or a compatible JDK configured:

```powershell
npm run android:bundle
```

Upload the bundle to Internal Testing and verify:

- Offering prices come from Google Play, not hard-coded UI.
- Monthly and annual purchases activate `track_pro`.
- Restore Purchases recovers the entitlement after reinstall.
- Payment verification through another app returns safely to QRY.
- Cancellation and expiry remove Pro access after RevenueCat refreshes customer information.
- Pending, interrupted, refunded, grace-period, account-hold, offline, and network-failure states never grant an unverified entitlement.
- Ads are suppressed only while a verified, current ad-free entitlement is active.
- The signed AAB's SDK list, permissions, network traffic, Privacy Policy, Terms, account-deletion guidance, Play Data safety answers, Ads/IAP declarations, and support procedures all match the enabled billing release.

The Android activity uses `singleTop`, as recommended for payment flows that temporarily background the application.
