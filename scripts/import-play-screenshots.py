"""Import eight canonical Android or browser captures as Google Play PNG assets."""

from __future__ import annotations

import argparse
from pathlib import Path
import shutil

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DESTINATION = ROOT / "store-assets" / "screenshots"
STEMS = (
    "01-home",
    "02-scan-result",
    "03-create",
    "04-library",
    "05-track",
    "06-record-actions",
    "07-operations",
    "08-studio",
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="Directory containing one PNG or JPEG capture for each canonical stem")
    parser.add_argument("--output", type=Path, default=DEFAULT_DESTINATION, help="Destination directory for normalized PNG files")
    parser.add_argument("--release", action="store_true", help="Require at least 1080x1920 native portrait captures")
    args = parser.parse_args()
    source = args.source.resolve()
    destination = args.output.resolve()
    if not source.is_dir():
        raise SystemExit(f"Capture directory does not exist: {source}")

    supported_suffixes = {".png", ".jpg", ".jpeg"}
    sources: list[Path] = []
    for stem in STEMS:
        matches = sorted(
            path for path in source.iterdir()
            if path.is_file() and path.stem.lower() == stem and path.suffix.lower() in supported_suffixes
        )
        if len(matches) != 1:
            raise SystemExit(f"Expected exactly one PNG or JPEG source for {stem}; found {[path.name for path in matches]}")
        sources.append(matches[0])

    dimensions: set[tuple[int, int]] = set()
    prepared: list[tuple[Path, Image.Image]] = []
    for input_path, stem in zip(sources, STEMS, strict=True):
        with Image.open(input_path) as captured:
            if captured.format not in {"JPEG", "PNG"}:
                raise SystemExit(f"{input_path.name}: expected an encoded PNG or JPEG capture, got {captured.format}")
            image = ImageOps.exif_transpose(captured).convert("RGB")
            dimensions.add(image.size)
            if abs((image.width / image.height) - (9 / 16)) > .01:
                raise SystemExit(f"{input_path.name}: expected a 9:16 capture, got {image.size}")
            if min(image.size) < 320 or max(image.size) > 3840:
                raise SystemExit(f"{input_path.name}: dimensions fall outside the Play upload range: {image.size}")
            if args.release and (image.width < 1080 or image.height < 1920):
                raise SystemExit(f"{input_path.name}: release capture must be at least 1080x1920, got {image.size}")
            prepared.append((destination / f"{stem}.png", image))

    if len(dimensions) != 1:
        raise SystemExit(f"All captures must use one viewport; found {sorted(dimensions)}")

    destination.mkdir(parents=True, exist_ok=True)
    temporary_paths: list[Path] = []
    committed: list[Path] = []
    existed = {target: target.is_file() for target, _image in prepared}
    try:
        for target, image in prepared:
            temporary = target.with_suffix(".tmp.png")
            image.save(temporary, format="PNG", optimize=True)
            temporary_paths.append(temporary)

        for target, _image in prepared:
            backup = target.with_suffix(".backup.png")
            backup.unlink(missing_ok=True)
            if existed[target]:
                shutil.copy2(target, backup)

        for input_path, (target, image), temporary in zip(sources, prepared, temporary_paths, strict=True):
            temporary.replace(target)
            committed.append(target)
            try:
                display_target = target.relative_to(ROOT)
            except ValueError:
                display_target = target
            print(f"{input_path.name} -> {display_target}  {image.width}x{image.height}  RGB PNG")
    except Exception:
        for target in reversed(committed):
            backup = target.with_suffix(".backup.png")
            if existed[target] and backup.is_file():
                backup.replace(target)
            elif not existed[target]:
                target.unlink(missing_ok=True)
        raise
    finally:
        for image_target, image in prepared:
            image.close()
            image_target.with_suffix(".tmp.png").unlink(missing_ok=True)
            image_target.with_suffix(".backup.png").unlink(missing_ok=True)


if __name__ == "__main__":
    main()
