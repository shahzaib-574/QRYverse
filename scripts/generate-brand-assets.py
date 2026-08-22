"""Generate deterministic QRYverse launcher, splash, web, and Play assets."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ANDROID_RES = ROOT / "android" / "app" / "src" / "main" / "res"
GREEN = "#173F35"
CREAM = "#FFFDF7"
CORAL = "#E77843"


def qr_mark(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], fill: str = CREAM) -> None:
    left, top, right, bottom = box
    size = right - left
    unit = size / 9

    def rect(x: float, y: float, w: float, h: float, color: str = fill) -> None:
        draw.rounded_rectangle(
            (left + x * unit, top + y * unit, left + (x + w) * unit, top + (y + h) * unit),
            radius=max(1, int(unit * .22)),
            fill=color,
        )

    def finder(x: float, y: float) -> None:
        rect(x, y, 3, 3)
        draw.rounded_rectangle(
            (left + (x + .72) * unit, top + (y + .72) * unit, left + (x + 2.28) * unit, top + (y + 2.28) * unit),
            radius=max(1, int(unit * .14)),
            fill=GREEN,
        )
        rect(x + 1.18, y + 1.18, .64, .64)

    finder(0, 0)
    finder(6, 0)
    finder(0, 6)
    rect(4, 4, 1, 1, CORAL)
    rect(5.5, 4, 1, 1)
    rect(7, 4, 2, 1)
    rect(4, 5.5, 1, 1)
    rect(5.5, 5.5, 2, 1)
    rect(8, 5.5, 1, 2.5)
    rect(4, 7, 1, 2)
    rect(5.5, 7, 1, 1)
    rect(6.8, 8, 1.1, 1)


def render_icon(size: int, *, round_icon: bool = False, foreground_only: bool = False, transparent_padding: bool = False) -> Image.Image:
    scale = 4
    transparent = foreground_only or transparent_padding
    canvas = Image.new("RGBA", (size * scale, size * scale), (0, 0, 0, 0) if transparent else CREAM)
    draw = ImageDraw.Draw(canvas)
    edge = size * scale

    if foreground_only:
        pad = int(edge * .27)
        qr_mark(draw, (pad, pad, edge - pad, edge - pad))
    else:
        pad = int(edge * .08) if transparent_padding else (0 if size >= 512 else int(edge * .04))
        if round_icon:
            # Use a mathematically circular alpha silhouette. Android lint's
            # launcher-shape detector is intentionally strict at mdpi/hdpi.
            draw.ellipse((pad, pad, edge - pad - 1, edge - pad - 1), fill=GREEN)
        else:
            draw.rounded_rectangle((pad, pad, edge - pad, edge - pad), radius=int(edge * .22), fill=GREEN)
        # Keep finder corners inside the circular alpha mask; at low Android
        # densities a .20 inset can protrude by a pixel after resampling.
        mark_pad = int(edge * (.23 if round_icon else .20))
        qr_mark(draw, (mark_pad, mark_pad, edge - mark_pad, edge - mark_pad))

    icon = canvas.resize((size, size), Image.Resampling.LANCZOS)
    if round_icon:
        # Android lint compares legacy round-icon alpha against a hard-edged
        # reference oval. Clip after resampling so low-density Lanczos fringe
        # cannot make an otherwise circular icon fail IconLauncherShape.
        final_pad = int(size * .08)
        alpha_mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(alpha_mask).ellipse(
            (final_pad, final_pad, size - final_pad - 1, size - final_pad - 1),
            fill=255,
        )
        icon.putalpha(alpha_mask)
    return icon


def render_splash(size: tuple[int, int]) -> Image.Image:
    width, height = size
    scale = 2
    canvas = Image.new("RGB", (width * scale, height * scale), CREAM)
    draw = ImageDraw.Draw(canvas)
    side = int(min(width, height) * .28 * scale)
    left = (width * scale - side) // 2
    top = (height * scale - side) // 2
    draw.rounded_rectangle((left, top, left + side, top + side), radius=int(side * .22), fill=GREEN)
    mark_pad = int(side * .20)
    qr_mark(draw, (left + mark_pad, top + mark_pad, left + side - mark_pad, top + side - mark_pad))
    return canvas.resize((width, height), Image.Resampling.LANCZOS)


def render_play_icon(size: int = 512) -> Image.Image:
    """Render a 32-bit RGBA full-bleed Play icon; Google Play applies the outer mask."""
    scale = 4
    edge = size * scale
    canvas = Image.new("RGBA", (edge, edge), GREEN)
    draw = ImageDraw.Draw(canvas)
    mark_pad = int(edge * .23)
    qr_mark(draw, (mark_pad, mark_pad, edge - mark_pad, edge - mark_pad))
    return canvas.resize((size, size), Image.Resampling.LANCZOS)


def crop_feature(source: Path, destination: Path) -> None:
    image = Image.open(source).convert("RGB")
    target_ratio = 1024 / 500
    current_ratio = image.width / image.height
    if current_ratio < target_ratio:
        crop_height = int(image.width / target_ratio)
        top = max(0, (image.height - crop_height) // 2)
        image = image.crop((0, top, image.width, top + crop_height))
    else:
        crop_width = int(image.height * target_ratio)
        left = max(0, (image.width - crop_width) // 2)
        image = image.crop((left, 0, left + crop_width, image.height))
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.resize((1024, 500), Image.Resampling.LANCZOS).save(destination, optimize=True)


def main() -> None:
    feature_source = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    store = ROOT / "store-assets"
    web_icons = ROOT / "public" / "icons"
    store.mkdir(exist_ok=True)
    web_icons.mkdir(parents=True, exist_ok=True)

    render_play_icon().save(store / "qryverse-play-icon-512.png", optimize=True)
    render_icon(192).save(web_icons / "icon-192.png", optimize=True)
    render_icon(512).save(web_icons / "icon-512.png", optimize=True)
    render_icon(512).save(web_icons / "icon-maskable-512.png", optimize=True)

    densities = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    for density, size in densities.items():
        folder = ANDROID_RES / f"mipmap-{density}"
        render_icon(size, transparent_padding=True).save(folder / "ic_launcher.png", optimize=True)
        render_icon(size, round_icon=True, transparent_padding=True).save(folder / "ic_launcher_round.png", optimize=True)

    if feature_source:
        crop_feature(feature_source, store / "qryverse-feature-graphic-1024x500.png")


if __name__ == "__main__":
    main()
