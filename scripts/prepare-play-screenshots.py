"""Validate the canonical Google Play image assets without modifying them."""

from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT_DIR = ROOT / "store-assets" / "screenshots"
PLAY_ICON = ROOT / "store-assets" / "qryverse-play-icon-512.png"
FEATURE_GRAPHIC = ROOT / "store-assets" / "qryverse-feature-graphic-1024x500.png"
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


def inspect_image(path: Path) -> tuple[str | None, str, tuple[int, int]]:
    try:
        with Image.open(path) as image:
            image.verify()
        with Image.open(path) as image:
            image.load()
            return image.format, image.mode, image.size
    except (OSError, SyntaxError) as error:
        raise SystemExit(f"{path.relative_to(ROOT)}: corrupt or unreadable image: {error}") from error


def main() -> None:
    icon_format, icon_mode, icon_size = inspect_image(PLAY_ICON)
    if icon_format != "PNG" or icon_mode != "RGBA" or icon_size != (512, 512):
        raise SystemExit(f"Play icon must be a 512x512 32-bit RGBA PNG; got {icon_format} {icon_mode} {icon_size}")
    print(f"{PLAY_ICON.relative_to(ROOT)}  {icon_size[0]}x{icon_size[1]}  {icon_mode}")

    feature_format, feature_mode, feature_size = inspect_image(FEATURE_GRAPHIC)
    if feature_format != "PNG" or feature_mode != "RGB" or feature_size != (1024, 500):
        raise SystemExit(f"Feature graphic must be a 1024x500 24-bit RGB PNG; got {feature_format} {feature_mode} {feature_size}")
    print(f"{FEATURE_GRAPHIC.relative_to(ROOT)}  {feature_size[0]}x{feature_size[1]}  {feature_mode}")

    sources = sorted(SCREENSHOT_DIR.glob("*.png"))
    names = tuple(source.name for source in sources)
    if names != EXPECTED:
        raise SystemExit(f"Expected exactly {EXPECTED}; found {names}")

    dimensions: set[tuple[int, int]] = set()
    for source in sources:
        image_format, image_mode, image_size = inspect_image(source)
        dimensions.add(image_size)
        if image_format != "PNG":
            raise SystemExit(f"{source.name}: extension is .png but encoded format is {image_format}")
        if image_mode != "RGB":
            raise SystemExit(f"{source.name}: screenshots must be 24-bit RGB with no alpha channel, got {image_mode}")
        if abs((image_size[0] / image_size[1]) - (9 / 16)) > .01:
            raise SystemExit(f"{source.name}: capture must use a 9:16 phone viewport, got {image_size}")
        if min(image_size) < 320 or max(image_size) > 3840:
            raise SystemExit(f"{source.name}: dimensions fall outside the Play upload range: {image_size}")
        print(f"{source.relative_to(ROOT)}  {image_size[0]}x{image_size[1]}  {image_mode}")

    if len(dimensions) != 1:
        raise SystemExit(f"All screenshots must use one viewport; found {sorted(dimensions)}")


if __name__ == "__main__":
    main()
