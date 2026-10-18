#!/usr/bin/env python3
"""從公開分享的 Google Drive 資料夾下載題庫 PDF 到 source/（已存在且大小相同的略過）。

用法：python3 scripts/fetch_drive.py [資料夾 ID 或網址]
預設資料夾：https://drive.google.com/drive/folders/15ASwC48jb33o47Fm_syRNPSfeoJzLmF2
下載後執行 python3 scripts/import_pdf.py 重建題庫。
"""

from __future__ import annotations

import html
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT = "15ASwC48jb33o47Fm_syRNPSfeoJzLmF2"


def get(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=120) as r:
        return r.read()


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else DEFAULT
    folder = re.search(r"folders/([\w-]+)", arg).group(1) if "folders/" in arg else arg
    page = get(f"https://drive.google.com/embeddedfolderview?id={folder}#list").decode("utf-8")
    entries = re.findall(r'<div class="flip-entry" id="entry-([\w-]+)".*?<div class="flip-entry-title">(.*?)</div>', page, re.S)
    pdfs = [(fid, html.unescape(name)) for fid, name in entries if name.lower().endswith(".pdf")]
    if not pdfs:
        raise SystemExit("資料夾裡找不到 PDF（資料夾要設成「知道連結的人都能檢視」）")
    out = ROOT / "source"
    out.mkdir(exist_ok=True)
    for fid, name in pdfs:
        data = get(f"https://drive.usercontent.google.com/download?id={fid}&export=download&confirm=t")
        if not data.startswith(b"%PDF"):
            print(f"✗ {name}：下載到的不是 PDF，略過")
            continue
        dest = out / name
        if dest.exists() and dest.stat().st_size == len(data):
            print(f"= {name}（沒有變動）")
            continue
        dest.write_bytes(data)
        print(f"↓ {name}（{len(data) // 1024} KB）")


if __name__ == "__main__":
    main()
