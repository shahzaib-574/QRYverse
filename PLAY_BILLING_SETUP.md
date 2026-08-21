# Google Play subscription activation

QRY uses RevenueCat's Capacitor SDK as the client for Google Play Billing. The code integration is complete, but store transactions remain disabled until these external configuration steps are completed.

## 1. Configure products

1. Create the Android app in Google Play Console using package ID `com.royal.qrystudio`.
2. Upload a signed internal-testing bundle.
3. Create monthly and annual subscription products for QRY Track Pro.
4. Add test accounts under license testing.

## 2. Configure RevenueCat

1. Create a RevenueCat project and Android app for the same package ID.
2. Connect its Google Play service credentials.
3. Import the Play subscription products.
4. Create entitlement `track_pro`.
5. Attach both products to that entitlement and add them to the current offering.

## 3. Configure the local release environment

Copy `.env.example` to an uncommitted `.env.production.local` file and add the public, app-specific Android SDK key:

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

The Android activity uses `singleTop`, as recommended for payment flows that temporarily background the application.
