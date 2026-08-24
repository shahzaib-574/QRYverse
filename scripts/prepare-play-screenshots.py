"""Validate the canonical Google Play image assets without modifying them."""

from __future__ import annotations

import argparse
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image, ImageCms


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


def inspect_image(path: Path) -> tuple[str | None, str, tuple[int, int], dict[str, Any]]:
    try:
        with Image.open(path) as image:
            image.verify()
        with Image.open(path) as image:
            image.load()
            return image.format, image.mode, image.size, dict(image.info)
    except (OSError, SyntaxError) as error:
        raise SystemExit(f"{path.relative_to(ROOT)}: corrupt or unreadable image: {error}") from error


def has_explicit_srgb(info: dict[str, Any]) -> bool:
    if "srgb" in info:
        return True
    profile = info.get("icc_profile")
    if not profile:
        return False
    try:
        name = ImageCms.getProfileName(ImageCms.ImageCmsProfile(BytesIO(profile)))
    except (OSError, TypeError) as error:
        raise SystemExit(f"Play icon has an unreadable ICC profile: {error}") from error
    return "srgb" in name.lower()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--release",
        action="store_true",
        help="Require recommendation-resolution screenshots and explicit sRGB icon metadata.",
    )
    args = parser.parse_args()

    icon_format, icon_mode, icon_size, icon_info = inspect_image(PLAY_ICON)
    if icon_format != "PNG" or icon_mode != "RGBA" or icon_size != (512, 512):
        raise SystemExit(f"Play icon must be a 512x512 32-bit RGBA PNG; got {icon_format} {icon_mode} {icon_size}")
    if PLAY_ICON.stat().st_size > 1024 * 1024:
        raise SystemExit(f"Play icon exceeds Google's 1024KB limit: {PLAY_ICON.stat().st_size} bytes")
    explicit_srgb = has_explicit_srgb(icon_info)
    if args.release and not explicit_srgb:
        raise SystemExit("Play icon release validation requires an embedded sRGB chunk or ICC profile")
    if not explicit_srgb:
        print("WARNING: Play icon has no embedded sRGB chunk or ICC profile; tag the final release export explicitly.")
    print(f"{PLAY_ICON.relative_to(ROOT)}  {icon_size[0]}x{icon_size[1]}  {icon_mode}")

    feature_format, feature_mode, feature_size, _feature_info = inspect_image(FEATURE_GRAPHIC)
    if feature_format != "PNG" or feature_mode != "RGB" or feature_size != (1024, 500):
        raise SystemExit(f"Feature graphic must be a 1024x500 24-bit RGB PNG; got {feature_format} {feature_mode} {feature_size}")
    print(f"{FEATURE_GRAPHIC.relative_to(ROOT)}  {feature_size[0]}x{feature_size[1]}  {feature_mode}")

    sources = sorted(SCREENSHOT_DIR.glob("*.png"))
    names = tuple(source.name for source in sources)
    if names != EXPECTED:
        raise SystemExit(f"Expected exactly {EXPECTED}; found {names}")

    dimensions: set[tuple[int, int]] = set()
    for source in sources:
        image_format, image_mode, image_size, _image_info = inspect_image(source)
        dimensions.add(image_size)
        if image_format != "PNG":
            raise SystemExit(f"{source.name}: extension is .png but encoded format is {image_format}")
        if image_mode != "RGB":
            raise SystemExit(f"{source.name}: screenshots must be 24-bit RGB with no alpha channel, got {image_mode}")
        if abs((image_size[0] / image_size[1]) - (9 / 16)) > .01:
            raise SystemExit(f"{source.name}: capture must use a 9:16 phone viewport, got {image_size}")
        if min(image_size) < 320 or max(image_size) > 3840:
            raise SystemExit(f"{source.name}: dimensions fall outside the Play upload range: {image_size}")
        if args.release and (image_size[0] < 1080 or image_size[1] < 1920):
            raise SystemExit(
                f"{source.name}: release screenshots must be at least 1080x1920 for Play recommendation formats; got {image_size}"
            )
        print(f"{source.relative_to(ROOT)}  {image_size[0]}x{image_size[1]}  {image_mode}")

    if len(dimensions) != 1:
        raise SystemExit(f"All screenshots must use one viewport; found {sorted(dimensions)}")

    print("Google Play release asset validation passed." if args.release else "Google Play provisional asset validation passed.")


if __name__ == "__main__":
    main()
