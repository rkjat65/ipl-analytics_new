#!/usr/bin/env python3
"""Validate Apple screenshots and create Play-friendly 9:16 variants."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
APPLE_DIR = ROOT / "store_assets" / "app_store" / "screenshots"
PLAY_DIR = ROOT / "store_assets" / "google_play" / "screenshots"


def main() -> None:
    PLAY_DIR.mkdir(parents=True, exist_ok=True)
    sources = sorted(APPLE_DIR.glob("*.png"))
    if len(sources) < 4:
        raise SystemExit("Expected at least four App Store screenshots")

    for source in sources:
        with Image.open(source) as opened:
            image = opened.convert("RGB")
        if image.size != (1320, 2868):
            raise SystemExit(f"Unexpected Apple screenshot size: {source} {image.size}")

        # App Store screenshots cannot contain an alpha channel.
        image.save(source, "PNG", optimize=True)

        # Preserve the complete tall iPhone UI in Google's recommended 9:16
        # canvas rather than cropping away the status bar or app navigation.
        canvas = Image.new("RGB", (1080, 1920), "#05070c")
        target_height = 1800
        target_width = round(image.width * target_height / image.height)
        scaled = image.resize((target_width, target_height), Image.Resampling.LANCZOS)
        x = (canvas.width - target_width) // 2
        y = (canvas.height - target_height) // 2

        shadow_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        shadow = ImageDraw.Draw(shadow_layer)
        shadow.rounded_rectangle(
            (x - 10, y - 10, x + target_width + 10, y + target_height + 10),
            radius=38,
            fill=(0, 222, 238, 75),
        )
        shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(28))
        canvas.paste(shadow_layer, mask=shadow_layer.getchannel("A"))
        canvas.paste(scaled, (x, y))

        output_name = source.name.replace("1320x2868", "1080x1920")
        canvas.save(PLAY_DIR / output_name, "PNG", optimize=True)

    print(f"Prepared {len(sources)} Apple and Google Play screenshots")


if __name__ == "__main__":
    main()
