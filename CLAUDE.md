# CLAUDE.md — JFDO 題庫練習

「單位知識」數學題庫（PDF，來源 Google Drive）的練習 App：知識點練習進度、依掌握度抽題、錯題本、詳解與問 AI。說明在 `README.md`。

## 重點
- 技術棧：Next.js 14 App Router + TypeScript + Tailwind（與 student-app、Self-learning-sys 一致）
- 版型：沿用 student-app v2 分頁的設計系統（`app/industry.css`，scope 在 `.v2-root`；桌機指令列、手機身分列＋底部導航、統計格、資料矩陣、blueprint 框、三段式掌握度條）。新畫面用 `v2-*` 類別與 `components/ui.tsx`，Tailwind 只用來排版
- **一律用中文回覆**
- 題庫：`source/*.pdf` → `scripts/import_pdf.py`（poppler＋Pillow）→ `public/bank/index.json`＋裁好的題目／答案／詳解圖。題目一律用圖顯示（PDF 數學式抽成文字會失真）；`text`、`answerText` 只能拿來搜尋／參考，不要拿來顯示或批改
- `public/bank/` 要 commit；改了 `import_pdf.py` 要重跑匯入並跑 `npm test`
- 知識點樹：章 → 節 → 知識點 → 子知識點 → 題型。進度只記在題型（`lib/bank.ts` 的 `leafKey`），上層一律彙總
- 純函式：`lib/mastery.ts`（掌握度）、`lib/plan.ts`（題數分配）、`lib/practice.ts`（批改、選題）、`lib/wrongbook.ts`（Leitner 複習）、`lib/bank.ts`（題庫結構與進度）；改邏輯後跑 `npm test`
- 資料層：畫面一律讀寫 `lib/storage.ts`（localStorage，依學生切換命名空間）；作答的副作用集中在 `recordAnswer`
- 學習行為剖析（`/habits`，說明在 `docs/LEARNING-PROFILE.md`）：`lib/learning-profile.ts` 移植自 Self-learning-sys（純函式，指標門檻都有研究出處，改了要同步更新文件）、`lib/profile-data.ts`（從練習紀錄組資料）；作答收集把握度、作答時間、看詳解時間（`SessionItem`）；冷靜作答在 `components/QuestionPanel.tsx`。用語只描述作答方式，不給人格／能力標籤
- 部署：GitHub Pages（`.github/workflows/pages.yml`，推 `main` 自動發佈，靜態網頁，`STATIC_EXPORT=1`、basePath `/JFDO`，建置時移除 `app/api`、`middleware.ts`）；自己組的網址要用 `lib/base.ts` 的 `withBase`。Vercel 可完整部署（含問 AI）
- 問 AI：`/api/ask` 把題目、答案、詳解圖送 Gemini（`lib/tutor.ts` 提示詞），圖片路徑只從題庫索引取、不接受前端傳入
- `lib/gemini.ts`、`components/SolutionView.tsx`、`components/GeometryFigure.tsx`、`components/MathText.tsx` 是 student-app 的逐字快照，不要單邊修改
- OLE-QS、Self-learning-sys、student-app 只作參考，不要修改或推送
- 發現原文件題目有誤：記下題目 id 告訴使用者（README 有「原文件的問題」表）

## 驗證
- `npx tsc --noEmit`、`npx next lint`、`npm test`、`npm run build`
- Vercel build 會跑 ESLint，未使用的 import/變數會讓 build 失敗
