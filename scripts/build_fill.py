#!/usr/bin/env python3
"""計算／填充題 → 學測選填格式。

讀 source/answers.tsv（從 PDF 答案圖逐題轉寫的 LaTeX 答案），寫進 public/bank/index.json：
    answerTex   正確答案（LaTeX，畫面顯示用，取代失真的 PDF 文字）
    fill        選填格式：{parts: [{label, tex, key, groups?}]}
                  tex   數字位置換成編號方格 \\boxed{n} 的答案式（分數線、根號、字母、文字都先寫好）
                  key   每一格的正確字元（0–9 或 −）
                  groups  「或」分隔的純數字答案（例如兩根）：各組的格子範圍，作答不限順序

規則（同學測選填）：每個數字一格；負號（不是減號）也是一格；10 的次方的底數 10 固定；\\text{} 裡的字不挖空。
開頭 "!" 的答案（文字答案等）不做選填，只給 answerTex，維持看答案自評。

單獨執行：python3 scripts/build_fill.py（import_pdf.py 匯入後也會自動套用）
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ANSWERS = ROOT / "source" / "answers.tsv"
INDEX = ROOT / "public" / "bank" / "index.json"
MAX_SLOTS = 20          # 格子太多（長的多項式組）不適合選填，改自評
OR = r"\text{ 或 }"
LABEL_RE = re.compile(r"^\((\d+)\)\s+")
# 這些之後出現的「-」是負號（一格），其他位置的「-」是減號（固定）
UNARY_AFTER = ("", "(", ",", "=", "{", "<", ">", r"\leq", r"\geq", r"\pm", r"\neq", "TEXT", "^")


def load_answers() -> dict[str, str]:
    out = {}
    if not ANSWERS.exists():
        return out
    for line in ANSWERS.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#"):
            continue
        qid, ans = line.split("\t", 1)
        out[qid] = ans.strip()
    return out


def templatize(tex: str, start: int = 0) -> tuple[str, list[str]]:
    """把答案式裡的數字（與負號）換成編號方格，回傳（題目上顯示的式子, 每格答案）；編號從 start+1 起（整題連續編號）"""
    out, key = [], []
    prev = ""          # 上一個有意義的 token（判斷負號）
    i = 0
    while i < len(tex):
        c = tex[i]
        if c == "\\":
            m = re.match(r"\\([a-zA-Z]+|.)", tex[i:])
            cmd = m.group(0)
            if cmd == r"\text":                     # \text{...} 原樣保留
                j = tex.index("}", i)
                out.append(tex[i:j + 1]); i = j + 1; prev = "TEXT"; continue
            out.append(cmd + (" " if cmd[1:].isalpha() else "")); i += len(cmd); prev = cmd; continue
        if c.isdigit():
            # 10 的次方：底數 10 固定（前面不是數字、小數點）
            if tex.startswith("10^", i) and not (out and re.search(r"[\d.]$", "".join(out))):
                out.append("10"); i += 2; prev = "10"; continue
            key.append(c); out.append(r"\boxed{\scriptstyle " + str(start + len(key)) + "}"); i += 1; prev = "D"; continue
        if c == "-":
            if prev in UNARY_AFTER:
                key.append("-"); out.append(r"\boxed{\scriptstyle " + str(start + len(key)) + "}")
            else:
                out.append("-")
            i += 1; prev = "-"; continue
        out.append(c)
        if not c.isspace():
            prev = c
        i += 1
    return "".join(out), key


def has_letter(tex: str) -> bool:
    plain = re.sub(r"\\text\{[^}]*\}", "", tex)
    plain = re.sub(r"\\[a-zA-Z]+", "", plain)
    return bool(re.search(r"[a-zA-Z]", plain))


def build_part(raw: str, start: int = 0) -> dict:
    m = LABEL_RE.match(raw)
    label = f"({m.group(1)})" if m else None
    tex = raw[m.end():] if m else raw
    shown, key = templatize(tex, start)
    part: dict = {"tex": shown, "key": key, "answer": tex}
    if label:
        part["label"] = label
    # 「或」分隔的純數字答案（例如方程式的兩根）：不限順序
    pieces = tex.split(OR)
    if len(pieces) > 1 and not any(has_letter(p) for p in pieces):
        groups, start = [], 0
        for p in pieces:
            n = len(templatize(p)[1])
            groups.append([start, start + n]); start += n
        if start == len(key):
            part["groups"] = groups
    return part


def apply(bank: dict) -> dict:
    """把 answers.tsv 套進題庫（就地修改並回傳）；回傳統計"""
    answers = load_answers()
    stats = {"fill": 0, "self": 0, "toolong": 0, "missing": 0}
    for q in bank["questions"]:
        q.pop("fill", None); q.pop("answerTex", None)
        if q["kind"] != "open" or q.get("noAnswer"):
            continue
        ans = answers.get(q["id"])
        if ans is None:
            if q["img"].get("a"):
                stats["missing"] += 1
            continue
        if ans.startswith("!"):
            q["answerTex"] = ans[1:].replace(" ;; ", r"\text{；}")
            stats["self"] += 1
            continue
        parts, n = [], 0
        for raw in ans.split(" ;; "):
            parts.append(build_part(raw, n)); n += len(parts[-1]["key"])
        q["answerTex"] = r"\text{；}".join((p.get("label", "") and r"\text{" + p["label"] + "}") + p["answer"] for p in parts)
        slots = sum(len(p["key"]) for p in parts)
        if slots == 0 or slots > MAX_SLOTS:
            stats["toolong" if slots else "self"] += 1
            continue
        q["fill"] = {"parts": [{k: v for k, v in p.items() if k != "answer"} for p in parts]}
        stats["fill"] += 1
    return stats


def crosscheck(bank: dict, answers: dict[str, str]) -> list[str]:
    """轉寫的數字順序 vs PDF 文字層的數字順序：文字層失真但數字大多保留，不一致的列出來人工複查"""
    out = []
    for q in bank["questions"]:
        a = answers.get(q["id"])
        if not a or a.startswith("!"):
            continue
        mine = re.sub(r"\\text\{[^}]*\}", "", re.sub(r"^\(\d+\)\s+|(?<= ;; )\(\d+\)\s+", "", a))
        mine = "".join(re.findall(r"\d", re.sub(r"\\sqrt\[\d+\]", r"\\sqrt", mine)))
        theirs = "".join(re.findall(r"\d", re.sub(r"[(（]\d+[)）]", "", q.get("answerText") or "")))
        if theirs and mine != theirs and sorted(mine) != sorted(theirs):
            out.append(f"{q['id']}\t轉寫 {mine}\tPDF {theirs}\t{a}")
    return out


def main():
    bank = json.loads(INDEX.read_text(encoding="utf-8"))
    stats = apply(bank)
    INDEX.write_text(json.dumps(bank, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"選填 {stats['fill']} 題、看答案自評 {stats['self']} 題、格子太多改自評 {stats['toolong']} 題、沒有轉寫 {stats['missing']} 題")
    diffs = crosscheck(bank, load_answers())
    print(f"數字順序與 PDF 文字層不一致：{len(diffs)} 題")
    for d in diffs:
        print("  " + d)


if __name__ == "__main__":
    main()
