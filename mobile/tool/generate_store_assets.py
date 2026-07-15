#!/usr/bin/env python3
"""Build deterministic Crickrida app/store artwork from the approved masters."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "assets" / "branding"
SOURCE = BRAND / "source"
PLAY = ROOT / "store_assets" / "google_play"
APP_STORE = ROOT / "store_assets" / "app_store"
SHARED = ROOT / "store_assets" / "shared"

ICON_SOURCE = SOURCE / "crickrida-icon-generated.png"
FEATURE_SOURCE = SOURCE / "play-feature-background-generated.png"
FONT_REGULAR = Path("/System/Library/Fonts/SFNS.ttf")
FONT_MONO = Path("/System/Library/Fonts/SFNSMono.ttf")


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size=size)


def centered_crop(image: Image.Image) -> Image.Image:
    edge = min(image.size)
    left = (image.width - edge) // 2
    top = (image.height - edge) // 2
    return image.crop((left, top, left + edge, top + edge))


def make_foreground(master: Image.Image) -> Image.Image:
    """Turn the near-black icon field into a soft transparent neon mark."""
    rgb = master.convert("RGB")
    pixels = []
    for red, green, blue in rgb.getdata():
        brightness = max(red, green, blue)
        alpha = max(0, min(255, int((brightness - 7) * 3.6)))
        pixels.append((red, green, blue, alpha))

    cutout = Image.new("RGBA", rgb.size)
    cutout.putdata(pixels)
    bbox = cutout.getbbox()
    if bbox:
        cutout = cutout.crop(bbox)

    foreground = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    fitted = ImageOps.contain(cutout, (690, 690), Image.Resampling.LANCZOS)
    foreground.alpha_composite(
        fitted,
        ((foreground.width - fitted.width) // 2, (foreground.height - fitted.height) // 2),
    )
    return foreground


def build_icon_assets() -> None:
    master = centered_crop(Image.open(ICON_SOURCE)).convert("RGB")
    master = ImageOps.fit(master, (1024, 1024), Image.Resampling.LANCZOS)
    master = ImageEnhance.Contrast(master).enhance(1.04)
    master.save(BRAND / "icon-master.png", optimize=True)
    master.save(APP_STORE / "app-icon-1024.png", optimize=True)

    play_icon = master.resize((512, 512), Image.Resampling.LANCZOS).convert("RGBA")
    play_icon.save(PLAY / "app-icon-512.png", optimize=True)

    foreground = make_foreground(master)
    foreground.save(BRAND / "adaptive-foreground.png", optimize=True)

    splash = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    splash_mark = ImageOps.contain(foreground, (760, 760), Image.Resampling.LANCZOS)
    splash.alpha_composite(splash_mark, ((1024 - splash_mark.width) // 2, (1024 - splash_mark.height) // 2))
    splash.save(BRAND / "splash-logo.png", optimize=True)

    favicon = master.resize((512, 512), Image.Resampling.LANCZOS)
    favicon.save(SHARED / "crickrida-logo-512.png", optimize=True)

    wordmark = Image.new("RGBA", (1600, 400), (0, 0, 0, 0))
    mark = ImageOps.contain(foreground, (360, 360), Image.Resampling.LANCZOS)
    wordmark.alpha_composite(mark, (20, 20))
    draw = ImageDraw.Draw(wordmark)
    draw.text((400, 100), "Crickrida", font=font(FONT_REGULAR, 150), fill=(232, 232, 237, 255))
    draw.text(
        (408, 270),
        "IPL ANALYTICS",
        font=font(FONT_MONO, 42),
        fill=(0, 229, 255, 255),
        spacing=6,
    )
    wordmark.save(SHARED / "crickrida-wordmark.png", optimize=True)


def build_feature_graphic() -> None:
    source = Image.open(FEATURE_SOURCE).convert("RGB")
    feature = ImageOps.fit(source, (1024, 500), Image.Resampling.LANCZOS)
    feature = ImageEnhance.Contrast(feature).enhance(1.05)

    overlay = Image.new("RGBA", feature.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rounded_rectangle((250, 112, 774, 388), radius=34, fill=(5, 8, 14, 198), outline=(0, 229, 255, 80), width=2)
    draw.rounded_rectangle((410, 145, 614, 153), radius=4, fill=(0, 229, 255, 255))

    title_font = font(FONT_REGULAR, 72)
    strap_font = font(FONT_REGULAR, 29)
    title = "Crickrida"
    strap = "IPL analytics. Every angle."
    title_box = draw.textbbox((0, 0), title, font=title_font)
    strap_box = draw.textbbox((0, 0), strap, font=strap_font)
    draw.text(((1024 - (title_box[2] - title_box[0])) / 2, 184), title, font=title_font, fill=(240, 243, 248, 255))
    draw.text(((1024 - (strap_box[2] - strap_box[0])) / 2, 292), strap, font=strap_font, fill=(184, 255, 0, 255))

    final = Image.alpha_composite(feature.convert("RGBA"), overlay).convert("RGB")
    final.save(PLAY / "feature-graphic-1024x500.png", optimize=True)


def main() -> None:
    for directory in (BRAND, PLAY, APP_STORE, SHARED):
        directory.mkdir(parents=True, exist_ok=True)
    build_icon_assets()
    build_feature_graphic()


if __name__ == "__main__":
    main()
