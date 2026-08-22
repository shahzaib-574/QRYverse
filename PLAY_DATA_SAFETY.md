# Google Play Data safety — v1 cloud-off launch

This worksheet applies only to the exact profile in `PLAY_LAUNCH_PROFILE.md`: ad-supported Android v1 for **adults ages 18 and older only**, no account, no QRYverse Cloud endpoint, no billing, and no first-party telemetry. File the Play form from the **signed production AAB**, current SDK disclosures, observed release traffic, and the publisher's executed vendor terms. Do not copy future-cloud assumptions into this declaration.

## Product data boundary

- QR history and created values, preferences, Track records/activity/evidence photos, staged roles, automation rules, local campaigns, and scrubbed diagnostics remain in private WebView/app storage.
- Camera and gallery images used for barcode recognition are processed on device. Scanner images are not retained; an evidence photo is stored only when the user deliberately attaches it.
- The binary has no account creation, login, cloud backup, hosted redirect, public campaign analytics, purchase SDK, entitlement service, or first-party analytics/crash uploader. The release guard rejects a configured `VITE_QRY_CLOUD_API_URL`.
- A system share/export, external destination open, or user-configured webhook test transfers data only after a clear user action to the destination the user chose. QRYverse does not receive a copy.
- Google Mobile Ads and UMP can transmit their documented ad/consent data after the SDK reports that an ad request is permitted.

## SDK inventory

| Component | Launch use | Data-safety review |
| --- | --- | --- |
| Google Mobile Ads + UMP via `@capacitor-community/admob` 8.1.0 | Consent/privacy flow and one adaptive banner on Home/Library | Google's disclosure identifies IP-derived approximate location, user product interactions, diagnostics, and device/account identifiers. Confirm current purposes, sharing treatment, and encryption in the Play SDK Index and vendor terms. |
| ML Kit barcode scanning / CameraX | Live camera and gallery barcode recognition | App code uses on-device recognition and never uploads or stores scanner image bytes. Reconfirm the locked ML Kit/Play-services graph and observed traffic from the candidate. |
| Capacitor Camera, Filesystem, Share, Haptics, App | User-requested image selection, exports/sharing, feedback, and lifecycle/deep-link handling | No developer collection is intended. Export/share destinations are selected by the user and have their own practices. |
| QRYverse local diagnostics | Up to 20 scrubbed events in local storage | No transmission in v1; users can export or erase them explicitly. |

## Conservative draft answers

The labels below mirror common Play categories, but the live Console wording controls.

| Play data type | Collected | Shared | Required/optional | Purpose and basis |
| --- | --- | --- | --- | --- |
| Location — Approximate location | Yes, by Google Mobile Ads when an ad request is allowed | Yes, to Google unless the publisher confirms an applicable service-provider exception | Automatic for an eligible ad request | Advertising, analytics, fraud prevention/security; inferred from IP, with no location permission. |
| App activity — App interactions | Yes, for ad/consent interactions | Yes, to Google subject to the final contractual classification | Automatic for SDK interactions | Advertising, analytics, fraud prevention/security. Local QR/Track interactions are not transmitted by first-party code. |
| App info and performance — Diagnostics | Yes, by the ad SDK | Yes, to Google subject to final classification | Automatic for the SDK | Diagnostics, analytics, fraud prevention/security. First-party diagnostic events remain local. |
| Device or other IDs | Yes, by the ad SDK | Yes, to Google subject to final classification | Automatic for an eligible SDK request | Advertising, analytics, fraud prevention/security. |
| Personal info, financial info, health/fitness, messages, contacts, photos/videos, audio, files/docs, calendar, precise location, browsing history, and other user content | No developer collection in this cloud-off binary | No developer sharing | — | These values may exist locally or leave only through an explicit user-directed export/share/open/webhook action. Re-evaluate if Play's current user-initiated-transfer rules or observed SDK traffic require a different answer. |
| Purchase history | No | No | — | No RevenueCat, Play Billing library, billing permission, product, purchase UI, or entitlement processing. |

## Console questions

| Question | v1 draft | Verification gate |
| --- | --- | --- |
| Does the app collect or share required data types? | **Yes** because the integrated ad SDK processes the four categories above | Confirm against the current Google Mobile Ads data-disclosure page, Play SDK Index, consent configuration, contracts, and captured traffic. |
| Is collected data encrypted in transit? | **Yes**, if candidate traffic confirms SDK TLS only | Capture first-launch, consent, privacy-options, and banner traffic from the signed candidate; investigate any cleartext host. |
| Can users request deletion? | The binary creates no QRYverse account and stores first-party content locally | Users can delete Library items/diagnostics or clear Android app storage. Publish the support page; handle Google-held ad data under Google's controls and the publisher's obligations. |
| Does the app provide account creation? | **No** | Confirm the release has no cloud URL and Studio displays the cloud-off state with no login/register controls. |
| Is data processed ephemerally? | Answer per SDK data type, not globally | Do not mark all ad data ephemeral without Google/vendor evidence. |
| Is collection optional? | Mixed | Local product use needs no account. Ad availability depends on applicable consent and publisher configuration; configure each type exactly as the Console asks. |

## Candidate traffic test

On a clean physical device using test ads/test geography, then again with the signed internal-test candidate:

1. Capture first launch before consent, consent accept/reject where offered, privacy-options reopening, app relaunch, and banner request/removal.
2. Verify revoking consent immediately removes any banner and no later banner request occurs while `canRequestAds` is false.
3. Scan with camera and gallery; create/save/delete codes; open a URL; share/export; attach an evidence photo; import/restore Track data; use a local campaign; and confirm content/image bytes are not sent by first-party code.
4. Confirm the release dependency graph, merged manifest, DEX/classes, and traffic contain no RevenueCat, Play Billing, `com.android.vending.BILLING`, QRYverse Cloud host, or first-party telemetry endpoint.
5. Inspect Advertising ID/AdServices declarations, every receiver/service/provider, Google Play SDK Index notices, and the final permission list.
6. Repeat with UMP consent-required and not-required test geographies, offline launch, denied camera permission, rotation, 200% font scaling, TalkBack, and app restart/persistence.

## Submission blockers

- [ ] Insert the real publisher/contact/legal details and publish reviewed privacy, terms, and local-data deletion pages at stable HTTPS URLs.
- [ ] Create production AdMob app/banner IDs and publish the applicable privacy messages. The publisher must confirm **18 and over only** in Google Play and compatible AdMob console declarations, review AdMob treatment settings, and complete app-ads.txt/publisher/app-readiness verification. Because there is no age gate or reliable user-age signal, keep the SDK child-directed and under-age-of-consent request tags unspecified.
- [ ] Build a fresh signed AAB with production IDs, `VITE_ADMOB_TEST_MODE=false`, and no cloud URL; never use the stale unsigned/test-ID bundle in existing build output.
- [ ] Complete the traffic/device test above and reconcile this worksheet with the exact artifact, current Google disclosures, vendor contracts, and Play Console wording.
- [ ] Review whether Google is “shared” or qualifies for an applicable service-provider exception under the publisher's actual agreement and jurisdiction; do not assume.
- [ ] Update this document whenever an SDK, endpoint, consent setting, audience, telemetry feature, purchase feature, or cloud capability changes.

Future cloud/account collection is documented in `CLOUD_BACKEND.md` and requires a new Data safety assessment before it can ship.
