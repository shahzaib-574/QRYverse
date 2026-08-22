# Google Play phone screenshots

The eight numbered PNG files in this directory are native 719 × 1278 production-browser captures. They were taken directly at a 9:16 mobile viewport without resizing or synthetic device chrome. Upload them in order:

1. `01-home.png` — private scanning entry
2. `02-scan-result.png` — URL preview and truthful on-device safety guidance
3. `03-create.png` — live QR generation
4. `04-library.png` — local organization
5. `05-track.png` — inventory workspace overview
6. `06-record-actions.png` — fast stock update sheet
7. `07-operations.png` — local reporting summary
8. `08-studio.png` — campaigns, backup, and business tools

Validate the canonical set without modifying it:

```powershell
python scripts/prepare-play-screenshots.py
```

The validation script never resizes screenshots. Recapture from the exact signed release candidate if visible UI changes. Never include test ads, personal account data, private QR payloads, browser chrome, or debug overlays.
