# JFDO 題庫練習

「單位知識」數學題庫的練習 App：列出每個知識點的練習進度、依掌握度抽題給學生練、自動收錄錯題並間隔複習，每題都附題庫原本的答案與詳解，看不懂還可以問 AI。

題目來源：Google Drive 資料夾 <https://drive.google.com/drive/folders/15ASwC48jb33o47Fm_syRNPSfeoJzLmF2>（目前有高一上第一章〈實數與指對數〉、第三章〈多項式〉，共 930 題）。

## 功能

| 頁面 | 內容 |
|---|---|
| `/` 知識點練習 | 章 → 節 → 知識點 → 子知識點 → 題型的樹狀列表，每層都顯示做過幾題、掌握度、等級（未練習／待加強／進步中／已掌握）。勾選題型（或「待加強」「還沒練」「整章」快速選），選題數後開始練習；每個題型也可以按「練 ▶」直接練 5 題 |
| `/practice` 作答 | 選項題（可能多選）與是非題自動批改；計算／填充／證明題在紙上算好後「對答案」自評。批改後顯示答案、**題庫詳解**、問 AI；答錯可記錄錯因與筆記 |
| `/wrong-book` 錯題本 | 答錯自動收錄，隔天開始複習，到期答對就拉長間隔（1、2、4、7、15 天），連續答對 5 次算克服。可依章節、錯因篩選，一鍵複習到期題或重做 |
| `/progress` 學習進度 | 近 14 天作答量、各章各節各知識點掌握度、最需要加強的題型、練習紀錄（可續做）、回報有誤的題目、匯出／匯入備份 |
| `/habits` 學習習慣 | 心理學研究為基礎的學習行為剖析（移植自 Self-learning-sys）：作答節奏（Kagan 沉思／衝動型）、快速猜題、疏失或系統性錯誤、答錯後的調整、連錯、後段失速、自我評估（高把握錯誤）、求助方式、原地打轉、分散與交錯練習；歸納成作答模式並給出有研究依據的建議與給家長的話。偵測到衝動型作答會自動開啟「冷靜作答」。說明在 `docs/LEARNING-PROFILE.md` |

- 選題：弱的、剛錯的、沒練過的題型多出（`lib/plan.ts`）；題型內先出沒做過的（照原文件順序由淺入深）、再出做錯過的、最後才是最久沒做的（`lib/practice.ts`），不同題型交錯出。
- 掌握度：沿用 Self-learning-sys 的類 Elo 模型（`lib/mastery.ts`），依把握度打折：每題依「有把握／不太確定／用猜的」送出，猜對加分少、有把握卻錯扣比較多。
- 作答過快（3 秒內）送出會先提醒一次；冷靜作答開啟時，送出前顯示檢查口訣、題目出現 5 秒後才能送出。
- 紀錄存在瀏覽器 localStorage，一台裝置可以有多位學生。

## 題庫怎麼來的

PDF 裡的數學式是 Word 方程式，抽成文字會失真，所以 `scripts/import_pdf.py` 只用文字層找結構（節、知識點、子知識點、題型、題號、【答案】、【詳解】）和每題位置，**題目、答案、詳解一律從 PDF 原樣裁成圖片**，數學式完全保真。選項題的選項數與答案、是非題的答案從文字層判斷，用來自動批改。

新增或更新章節：

```bash
npm run fetch      # 從 Google Drive 資料夾下載 PDF 到 source/（需要資料夾公開分享）
npm run bank       # 重建 public/bank/（需要 poppler 的 pdftotext、pdftoppm 與 Pillow）
npm test           # 檢查圖片都在、答案在選項範圍內等
```

檔名要包含「高一上第一章…」這種格式（例：`01單位知識高一上第一章實數與指對數.pdf`）。產生的 `public/bank/` 要 commit（部署時不跑匯入）。

### 原文件的問題（匯入時發現）

| 題目 | 問題 | 處理 |
|---|---|---|
| 第一章 E-1 題型四 第 4 題 | 沒有附答案和詳解（空白的【答案】【詳解】跑到第 5 題裡） | 標記 `noAnswer`，不出題 |
| 第一章 I-2 題型三 第 3 題 | 不是題目，是給工程師的編輯說明「這部分請工程師操作時，隨機抽選拼成小題」 | 略過；第 1、2 題照常出 |
| 第一章 A-1 題型二 第 5 題 | 證明題，只有【證明】沒有【答案】 | 照常出題，對答案時顯示證明 |

## 部署

| 方式 | 網址 | 功能 | 怎麼更新 |
|---|---|---|---|
| **GitHub Pages**（已設定） | <https://czpeanut.github.io/JFDO/> | 全部功能，**但沒有「問 AI」與整站通行碼**（靜態網頁沒有伺服器） | 推到 `main` 就自動建置發佈（`.github/workflows/pages.yml` → `gh-pages` 分支） |
| **Vercel**（要問 AI 時） | Vercel 給的網址 | 全部功能 | Vercel → Add New Project → 匯入 `czpeanut/JFDO`，Environment Variables 設 `GEMINI_API_KEY`（建議再設 `SITE_ACCESS_CODE`）；之後推 `main` 自動部署 |

GitHub Pages 第一次部署後，若網址打不開：repo 的 Settings → Pages → Source 選「Deploy from a branch」、分支選 `gh-pages` ／ `/(root)`（只需要設一次）。

## 開發

```bash
npm install
npm run dev        # http://localhost:3000
npx tsc --noEmit && npx next lint && npm test && npm run build
```

| 環境變數 | 說明 |
|---|---|
| `GEMINI_API_KEY` | 問 AI（選用；沒設時其他功能照常） |
| `GEMINI_SOLVE_MODEL` | 問 AI 的模型，預設 `gemini-3.7-flash`（與 student-app 詳解相同） |
| `SITE_ACCESS_CODE` | 整站通行碼（選用；設了之後裝置要先輸入一次，避免外人用掉 AI 額度） |

版型沿用 student-app v2 分頁的設計系統（`app/industry.css`）。技術棧與 student-app、Self-learning-sys 相同：Next.js 14 App Router + TypeScript + Tailwind。`lib/gemini.ts`、`components/SolutionView.tsx`、`components/GeometryFigure.tsx`、`components/MathText.tsx` 是 student-app 的快照。
