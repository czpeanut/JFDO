#!/usr/bin/env python3
"""產生 App 圖示（public/icons/）：v2 設計系統的主色底＋白色 JFDO 字樣＋品牌方塊＋四角對位標記。

用法：python3 scripts/make_icons.py <BarlowCondensed-SemiBold.ttf>
字型：https://raw.githubusercontent.com/google/fonts/main/ofl/barlowcondensed/BarlowCondensed-SemiBold.ttf（OFL 授權）
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "icons"
ACCENT = (0x59, 0x80, 0xA6)   # --color-accent
WHITE = (255, 255, 255)


def draw(size: int, font_path: str, safe: float) -> Image.Image:
    """safe：內容所佔比例（maskable 圖示要縮在中間 80% 的安全區）"""
    S = 4 * size                                   # 先畫 4 倍再縮小，邊緣平滑
    im = Image.new("RGB", (S, S), ACCENT)
    d = ImageDraw.Draw(im)
    pad = S * (1 - safe) / 2
    box = S - 2 * pad                              # 內容區邊長
    # 四角對位標記（blueprint 的 corner）
    arm, w, inset = box * 0.09, max(2, int(box * 0.012)), pad + box * 0.07
    for cx, cy in ((inset, inset), (S - inset, inset), (inset, S - inset), (S - inset, S - inset)):
        d.rectangle([cx - arm / 2, cy - w / 2, cx + arm / 2, cy + w / 2], fill=WHITE)
        d.rectangle([cx - w / 2, cy - arm / 2, cx + w / 2, cy + arm / 2], fill=WHITE)
    # 字樣 JFDO
    font = ImageFont.truetype(font_path, int(box * 0.40))
    l, t, r, b = d.textbbox((0, 0), "JFDO", font=font)
    tx, ty = (S - (r - l)) / 2 - l, (S - (b - t)) / 2 - t + box * 0.04
    d.text((tx, ty), "JFDO", font=font, fill=WHITE)
    # 品牌方塊（字樣左上方）
    m = box * 0.075
    d.rectangle([tx + l, ty + t - m * 1.9, tx + l + m, ty + t - m * 0.9], fill=WHITE)
    return im.resize((size, size), Image.LANCZOS)


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    font = sys.argv[1]
    OUT.mkdir(parents=True, exist_ok=True)
    for name, size, safe in (("icon-192.png", 192, 0.92), ("icon-512.png", 512, 0.92), ("maskable-512.png", 512, 0.72),
                             ("apple-touch-icon.png", 180, 0.92), ("favicon-32.png", 32, 1.0)):
        draw(size, font, safe).save(OUT / name, optimize=True)
        print("→", OUT / name)


if __name__ == "__main__":
    main()
