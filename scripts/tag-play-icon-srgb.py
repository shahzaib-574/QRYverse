"""Embed an explicit sRGB ICC profile in the Google Play icon without changing pixels."""

from __future__ import annotations

import argparse
import hashlib
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageCms


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ICON = ROOT / "store-assets" / "qryverse-play-icon-512.png"


def pixel_digest(image: Image.Image) -> str:
    return hashlib.sha256(image.tobytes()).hexdigest().upper()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("icon", nargs="?", type=Path, default=DEFAULT_ICON)
    args = parser.parse_args()
    icon_path = args.icon.resolve()
    if not icon_path.is_file():
        raise SystemExit(f"Play icon does not exist: {icon_path}")

    with Image.open(icon_path) as source:
        source.load()
        if source.format != "PNG" or source.mode != "RGBA" or source.size != (512, 512):
            raise SystemExit(
                f"Play icon must be a 512x512 RGBA PNG; got {source.format} {source.mode} {source.size}"
            )
        original_digest = pixel_digest(source)
        embedded_profile = source.info.get("icc_profile")
        if embedded_profile:
            profile_name = ImageCms.getProfileName(ImageCms.ImageCmsProfile(BytesIO(embedded_profile))).strip()
            if "srgb" not in profile_name.lower():
                raise SystemExit(f"Play icon already has a non-sRGB ICC profile: {profile_name}")
            print(f"Play icon already has an sRGB ICC profile: {icon_path}")
            print(f"Pixel SHA-256: {original_digest}")
            return
        original = source.copy()

    profile = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
    temporary = icon_path.with_suffix(".srgb.tmp.png")
    try:
        original.save(temporary, format="PNG", optimize=True, icc_profile=profile)
        with Image.open(temporary) as tagged:
            tagged.load()
            if pixel_digest(tagged) != original_digest:
                raise SystemExit("sRGB tagging changed the icon pixels")
            if not tagged.info.get("icc_profile"):
                raise SystemExit("sRGB tagging did not embed an ICC profile")
        temporary.replace(icon_path)
    finally:
        original.close()
        temporary.unlink(missing_ok=True)

    print(f"Embedded sRGB ICC profile in {icon_path}")
    print(f"Pixel SHA-256 (unchanged): {original_digest}")


if __name__ == "__main__":
    main()
