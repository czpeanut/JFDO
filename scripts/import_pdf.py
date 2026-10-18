#!/usr/bin/env python3
"""把「單位知識」題庫 PDF（source/*.pdf）轉成 app 用的題庫：
    public/bank/index.json    知識點樹（章 → 節 → 知識點 → 子知識點 → 題型）＋每題的答案、作答方式、圖片路徑
    public/bank/<章>/<id>-q-1.png   題目（題號到【答案】前）
                     <id>-a-1.png   答案（【答案】到【詳解】前）
                     <id>-s-1.png   詳解（【詳解】到下一題前）

PDF 裡的數學式是 Word 方程式，抽成文字會失真（次方、分數、∈ 都會壞掉），
所以文字層只用來找結構與每題的位置，題目／答案／詳解一律從 PDF 原樣裁成圖片，數學式完全保真。
跨頁的題目會裁成好幾張（-1、-2…），依序顯示。

需要：poppler（pdftotext、pdftoppm）、Pillow。
用法：python3 scripts/import_pdf.py [PDF ...]     # 預設 source/*.pdf
"""

from __future__ import annotations

import html
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
OUT_JSON = ROOT / "public" / "bank" / "index.json"
OUT_IMG = ROOT / "public" / "bank"
DPI = 144                      # 1pt = 2px：手機上清楚、檔案不會太大
SCALE = DPI / 72
CN = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10}


def cn_num(t: str) -> int:
    if "十" in t:
        a, _, b = t.partition("十")
        return (CN.get(a, 1) if a else 1) * 10 + (CN.get(b, 0) if b else 0)
    return CN.get(t, 0)


# ── 讀文字層（每行的位置） ──
LINE_RE = re.compile(r'<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</line>', re.S)
PAGE_RE = re.compile(r'<page width="([\d.]+)" height="([\d.]+)">(.*?)</page>', re.S)
WORD_RE = re.compile(r">([^<]*)</word>")


def read_lines(pdf: Path) -> tuple[list[dict], list[tuple[float, float]]]:
    with tempfile.NamedTemporaryFile(suffix=".html") as f:
        subprocess.run(["pdftotext", "-bbox-layout", str(pdf), f.name], check=True)
        s = Path(f.name).read_text(encoding="utf-8")
    lines, sizes = [], []
    for pno, pm in enumerate(PAGE_RE.finditer(s)):
        sizes.append((float(pm.group(1)), float(pm.group(2))))
        for m in LINE_RE.finditer(pm.group(3)):
            text = " ".join(html.unescape(w) for w in WORD_RE.findall(m.group(5))).strip()
            if text:
                lines.append({"page": pno, "x": float(m.group(1)), "y0": float(m.group(2)), "x1": float(m.group(3)), "y1": float(m.group(4)), "text": text})
    return lines, sizes


# ── 結構辨識 ──
SECTION_RE = re.compile(r"^高[一二三][上下]\s*(?:第\s*[一二三四五六七八九十]+\s*章)?\s*(\d+\s*-\s*\d+)\s*(.+)$")
CHAPTER_RE = re.compile(r"^(高[一二三][上下])\s*第\s*([一二三四五六七八九十]+)\s*章\s+(\S.*)$")
KP_RE = re.compile(r"^知識點\s*([A-Z])\s*[：:]\s*(.+)$")
SUB_RE = re.compile(r"^([A-Z]\s*-\s*\d+)\s*[：:]\s*(.+)$")
TYPE_RE = re.compile(r"^題型\s*([一二三四五六七八九十]+)\s*[：:]\s*(.+)$")
QNO_RE = re.compile(r"^(\d{1,3})\s*[.．](?:\s+(.*))?$")
TOC_RE = re.compile(r"[.．…]{6,}")


def norm(t: str) -> str:
    return re.sub(r"\s+", "", t)


def classify(ln: dict, footer_y: float) -> tuple[str, re.Match | None]:
    t = ln["text"]
    if TOC_RE.search(t):
        return "toc", None
    if ln["y0"] >= footer_y and re.fullmatch(r"\d+", t):
        return "footer", None
    if ln["x"] < 85:
        for kind, rx in (("section", SECTION_RE), ("kp", KP_RE), ("sub", SUB_RE), ("type", TYPE_RE), ("q", QNO_RE)):
            m = rx.match(t)
            if m:
                return kind, m
    if t.startswith("【答案】"):
        return "answer", None
    if t.startswith(("【詳解】", "【證明】", "【解題】")):
        return "solution", None
    return "text", None


def build(pdf: Path) -> dict:
    lines, sizes = read_lines(pdf)
    m = re.search(r"(高[一二三][上下])\s*第\s*([一二三四五六七八九十]+)\s*章\s*(.+?)\.pdf$", pdf.name)
    if not m:
        raise SystemExit(f"檔名看不出章節：{pdf.name}（格式：…高一上第一章實數與指對數.pdf）")
    book, ch_no, ch_title = m.group(1), cn_num(m.group(2)), m.group(3)
    ch_id = f"{book}-{ch_no}"
    footer_y = min(h for _, h in sizes) - 70    # 頁碼在頁面底部約 60pt 處

    # 每頁內容的上下界（裁跨頁時用）：頁碼以上、第一行以上
    page_top: dict[int, float] = {}
    page_bottom: dict[int, float] = {}
    for ln in lines:
        k, _ = classify(ln, footer_y)
        if k == "footer":
            page_bottom[ln["page"]] = min(page_bottom.get(ln["page"], 1e9), ln["y0"] - 6)
        elif k != "toc":
            page_top[ln["page"]] = min(page_top.get(ln["page"], 1e9), ln["y0"] - 4)

    # 依閱讀順序走過所有行，產生「標記」：結構標題、題號、【答案】、【詳解】
    lines.sort(key=lambda l: (l["page"], l["y0"], l["x"]))
    marks: list[dict] = []
    started = False
    for ln in lines:
        k, mm = classify(ln, footer_y)
        if k == "section":
            started = True
        if not started or k in ("toc", "footer", "text"):
            continue
        marks.append({"kind": k, "m": mm, "line": ln})

    def top_of(ln: dict) -> tuple[int, float]:
        # 同一行裡較高的字（分數的分子、上標）pdftotext 會拆成另一行，往上包進來
        same = [l for l in lines if l["page"] == ln["page"] and l["y1"] > ln["y0"] + 1 and l["y0"] < ln["y1"]]
        return ln["page"], min([ln["y0"]] + [l["y0"] for l in same]) - 3

    sections, questions = [], []
    cur = {"section": None, "kp": None, "sub": None, "type": None}
    q: dict | None = None
    region: str | None = None
    region_start: tuple[int, float] | None = None

    def close_region(end: tuple[int, float]):
        nonlocal region, region_start
        if q is not None and region and region_start:
            q["_regions"][region] = (region_start, end)
        region, region_start = None, None

    def finish_question(end: tuple[int, float]):
        nonlocal q
        close_region(end)
        if q is not None:
            questions.append(q)
        q = None

    for mk in marks:
        k, mm, ln = mk["kind"], mk["m"], mk["line"]
        pos = top_of(ln)
        if k in ("section", "kp", "sub", "type", "q"):
            finish_question(pos)
        if k == "section":
            code = norm(mm.group(1))
            cur.update(section={"id": code, "title": mm.group(2).strip(), "kps": []}, kp=None, sub=None, type=None)
            sections.append(cur["section"])
        elif k == "kp":
            if not cur["section"]:
                continue
            cur.update(kp={"id": mm.group(1), "title": mm.group(2).strip(), "subs": []}, sub=None, type=None)
            cur["section"]["kps"].append(cur["kp"])
        elif k == "sub":
            if not cur["kp"]:
                continue
            cur.update(sub={"id": norm(mm.group(1)), "title": mm.group(2).strip(), "types": []}, type=None)
            cur["kp"]["subs"].append(cur["sub"])
        elif k == "type":
            if not cur["sub"]:
                continue
            cur["type"] = {"id": f"T{cn_num(mm.group(1))}", "title": mm.group(2).strip()}
            cur["sub"]["types"].append(cur["type"])
        elif k == "q":
            if not cur["sub"]:
                continue
            tid = cur["type"]["id"] if cur["type"] else "T0"
            if not cur["type"]:   # 子知識點底下直接出題（沒有分題型）
                cur["type"] = {"id": "T0", "title": cur["sub"]["title"]}
                cur["sub"]["types"].append(cur["type"])
            no = int(mm.group(1))
            q = {"id": f"{ch_id}_{cur['sub']['id']}_{tid}_{no}", "chapter": ch_id, "section": cur["section"]["id"], "kp": cur["kp"]["id"],
                 "sub": cur["sub"]["id"], "type": tid, "no": no, "_regions": {}, "_text": {"q": [], "a": [], "s": []}}
            region, region_start = "q", pos
        elif k == "answer" and q is not None:
            close_region(pos)
            region, region_start = "a", pos
        elif k == "solution" and q is not None:
            close_region(pos)
            region, region_start = "s", pos
    finish_question((len(sizes) - 1, page_bottom.get(len(sizes) - 1, sizes[-1][1] - 70)))

    # 每題的文字（失真，只用來判斷作答方式與搜尋）
    for qq in questions:
        for r, (a, b) in qq["_regions"].items():
            qq["_text"][r] = [l["text"] for l in lines if a <= (l["page"], l["y0"] + 2) < b and classify(l, footer_y)[0] not in ("footer", "toc")]

    # 去掉沒有題目的子知識點／題型
    used = {(q["section"], q["kp"], q["sub"], q["type"]) for q in questions}
    for s in sections:
        for kp in s["kps"]:
            for sub in kp["subs"]:
                sub["types"] = [t for t in sub["types"] if (s["id"], kp["id"], sub["id"], t["id"]) in used]
            kp["subs"] = [x for x in kp["subs"] if x["types"]]
        s["kps"] = [x for x in s["kps"] if x["subs"]]
    return {"id": ch_id, "book": book, "no": ch_no, "title": ch_title, "source": pdf.name, "sections": [s for s in sections if s["kps"]],
            "_questions": questions, "_sizes": sizes, "_page_top": page_top, "_page_bottom": page_bottom}


# ── 作答方式：選擇（可自動批改）／是非／其他（看答案自己對） ──
def answer_kind(qtext: list[str], atext: list[str]) -> dict:
    ans = norm("".join(atext).replace("【答案】", ""))
    stem = " ".join(qtext)
    # 選項標號：詞首的 (k)（避開 f(7)、(－2) 這類括號），取從 (1) 連續編號的最大值
    opts = {int(x) for x in re.findall(r"(?:^|\s)[(（]\s*(\d)\s*[)）]", stem)}
    n = 0
    while n + 1 in opts:
        n += 1
    picks = re.fullmatch(r"(?:[(（]\d[)）])+", ans)
    if picks and n >= 2:
        chosen = sorted({int(x) for x in re.findall(r"\d", ans)})
        if all(1 <= c <= n for c in chosen):
            return {"kind": "choice", "options": n, "answer": chosen, "single": "單選" in stem}
    if ans in ("○", "◯", "O", "Ｏ"):
        return {"kind": "tf", "answer": True}
    if ans in ("╳", "×", "X", "Ｘ", "✕"):
        return {"kind": "tf", "answer": False}
    return {"kind": "open", "answerText": ans}


# ── 裁圖 ──
def render_pages(pdf: Path, tmp: Path) -> list[Path]:
    subprocess.run(["pdftoppm", "-r", str(DPI), "-gray", "-png", str(pdf), str(tmp / "p")], check=True)
    return sorted(tmp.glob("p-*.png"), key=lambda p: int(p.stem.split("-")[1]))


def trim(img: Image.Image) -> Image.Image | None:
    # 去掉上下與右側空白；左邊保留固定邊界，題目之間對齊（前端以固定比例顯示，字的大小一致）
    inv = ImageOps.invert(img.point(lambda v: 255 if v > 235 else v))
    box = inv.getbbox()
    if not box:
        return None
    _, top, right, bottom = box
    return img.crop((0, max(0, top - 6), min(img.width, right + 12), min(img.height, bottom + 6)))


def crop_region(pages: list[Image.Image], ch: dict, a: tuple[int, float], b: tuple[int, float]) -> list[Image.Image]:
    out = []
    for p in range(a[0], b[0] + 1):
        w, h = ch["_sizes"][p]
        top = a[1] if p == a[0] else ch["_page_top"].get(p, 56)
        bottom = b[1] if p == b[0] else ch["_page_bottom"].get(p, h - 70)
        if bottom - top < 6:
            continue
        img = pages[p].crop((int(56 * SCALE), int(top * SCALE), int((w - 48) * SCALE), int(bottom * SCALE)))
        img = trim(img)
        if img is not None and img.height > 10:
            out.append(img)
    return out


def save(img: Image.Image, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    # 16 階灰：文字圖檔案小很多、看起來一樣
    img.point(lambda v: (v // 16) * 17).convert("L").quantize(16).save(path, optimize=True)


def main():
    pdfs = [Path(p) for p in sys.argv[1:]] or sorted((ROOT / "source").glob("*.pdf"))
    if not pdfs:
        raise SystemExit("source/ 裡沒有 PDF")
    bank = json.loads(OUT_JSON.read_text(encoding="utf-8")) if OUT_JSON.exists() else {"chapters": [], "questions": []}
    for pdf in pdfs:
        ch = build(pdf)
        print(f"{pdf.name}：{len(ch['_questions'])} 題、{len(ch['sections'])} 節")
        out_dir = OUT_IMG / ch["id"]
        if out_dir.exists():
            for f in out_dir.glob("*.png"):
                f.unlink()
        with tempfile.TemporaryDirectory() as tmp:
            pages = [Image.open(p).convert("L") for p in render_pages(pdf, Path(tmp))]
            qs = []
            for q in ch["_questions"]:
                imgs = {}
                for r in ("q", "a", "s"):
                    if r not in q["_regions"]:
                        continue
                    parts = crop_region(pages, ch, *q["_regions"][r])
                    names = []
                    for i, im in enumerate(parts, 1):
                        name = f"{q['id']}-{r}-{i}.png"
                        save(im, out_dir / name)
                        names.append(f"/bank/{ch['id']}/{name}")
                    imgs[r] = names
                text = re.sub(r"^\d+\s*[.．]\s*", "", " ".join(q["_text"]["q"]))
                if not imgs.get("q"):
                    print(f"  ⚠ {q['id']} 裁不到題目，略過")
                    continue
                if "工程師" in text and not imgs.get("a"):
                    print(f"  ⚠ {q['id']} 是給工程師的編輯說明（{text[:30]}…），略過")
                    continue
                extra = {}
                if not imgs.get("a") and not imgs.get("s"):
                    print(f"  ⚠ {q['id']} 原文件沒有附答案與詳解，標記 noAnswer（不出題）")
                    extra["noAnswer"] = True
                elif not imgs.get("a"):
                    print(f"  ⓘ {q['id']} 沒有【答案】，只有詳解／證明")
                kind = answer_kind(q["_text"]["q"], q["_text"]["a"])
                qs.append({k: v for k, v in q.items() if not k.startswith("_")} | kind | extra | {"img": imgs, "text": text[:300]})
        chapter = {k: v for k, v in ch.items() if not k.startswith("_")}
        bank["chapters"] = sorted([c for c in bank["chapters"] if c["id"] != ch["id"]] + [chapter], key=lambda c: (c["book"], c["no"]))
        bank["questions"] = [x for x in bank["questions"] if x["chapter"] != ch["id"]] + qs
        kinds = {}
        for x in qs:
            kinds[x["kind"]] = kinds.get(x["kind"], 0) + 1
        print(f"  收錄 {len(qs)} 題：選擇 {kinds.get('choice', 0)}、是非 {kinds.get('tf', 0)}、其他（看答案自評）{kinds.get('open', 0)}")
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(bank, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"→ {OUT_JSON.relative_to(ROOT)}：{len(bank['chapters'])} 章、{len(bank['questions'])} 題")


if __name__ == "__main__":
    main()
