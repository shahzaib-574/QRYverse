# Google Play phone screenshots

The eight numbered files in this directory are 719 × 1278 RGB PNG browser captures of the production build in the light theme. They were taken directly at a 9:16 mobile viewport without resizing or synthetic device chrome. They are provisional listing assets, not signed-device screenshots. The planned production sequence is:

1. `01-home.png` — private scanning entry
2. `02-scan-result.png` — URL preview and truthful on-device safety guidance
3. `03-create.png` — QR creation; the current empty preview must be recaptured with a generated code
4. `04-library.png` — local organization; the current clipped Scan transition must be recaptured
5. `05-track.png` — inventory workspace overview
6. `06-record-actions.png` — fast stock update sheet
7. `07-operations.png` — local reporting summary
8. `08-studio.png` — campaigns, backup, and business tools

Import one `.png`, `.jpg`, or `.jpeg` capture for each explicitly named stem. The importer accepts native Android PNG screenshots as well as browser JPEG captures, normalizes them to 24-bit RGB PNG without resizing, and rejects duplicates:

```powershell
python scripts/import-play-screenshots.py "C:\path\to\canonical-browser-captures"
```

```powershell
python scripts/prepare-play-screenshots.py
```

For the signed production capture set, use both strict gates:

```powershell
python scripts/import-play-screenshots.py "C:\path\to\signed-android-captures" --release
python scripts/prepare-play-screenshots.py --release
```

Strict validation requires every portrait frame to be at least 1080 × 1920 and requires the Play icon to carry explicit sRGB/ICC metadata. It cannot prove that pixels were captured natively rather than upscaled, so retain the signed-artifact and device provenance described in the audit.

The importer converts pixels without resizing; the validator rejects mislabeled formats, wrong dimensions, wrong color modes, or an incomplete set. Recapture from the exact signed release candidate before final Play submission and whenever visible UI changes. Never include test ads, personal account data, private QR payloads, browser chrome, or debug overlays.

See [`../PLAY_ASSET_AUDIT.md`](../PLAY_ASSET_AUDIT.md) for the exact metadata inventory, visual findings, current Play requirements, and signed-device recapture contract. In particular, do not promote the current `03-create.png` or `04-library.png` to production: the former shows an empty preview and the latter captured a clipped navigation transition.
