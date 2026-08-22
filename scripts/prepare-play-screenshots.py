"""Validate the canonical Google Play screenshots without modifying them."""

from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT_DIR = ROOT / "store-assets" / "screenshots"
EXPECTED = (
    "01-home.png",
    "02-scan-result.png",
    "03-create.png",
    "04-library.png",
    "05-track.png",
    "06-record-actions.png",
    "07-operations.png",
    "08-studio.png",
)


def main() -> None:
    sources = sorted(SCREENSHOT_DIR.glob("*.png"))
    names = tuple(source.name for source in sources)
    if names != EXPECTED:
        raise SystemExit(f"Expected exactly {EXPECTED}; found {names}")

    dimensions: set[tuple[int, int]] = set()
    for source in sources:
        with Image.open(source) as image:
            dimensions.add(image.size)
            if abs((image.width / image.height) - (9 / 16)) > .01:
                raise SystemExit(f"{source.name}: capture must use a 9:16 phone viewport, got {image.size}")
            if min(image.size) < 320 or max(image.size) > 3840:
                raise SystemExit(f"{source.name}: dimensions fall outside the Play upload range: {image.size}")
            print(f"{source.relative_to(ROOT)}  {image.width}x{image.height}  {image.mode}")

    if len(dimensions) != 1:
        raise SystemExit(f"All screenshots must use one viewport; found {sorted(dimensions)}")


if __name__ == "__main__":
    main()
