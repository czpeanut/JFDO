# App（Android／iPhone 雙平台安裝）

JFDO 是可安裝的 **PWA**：同一個網站，Android 和 iPhone／iPad 都能安裝到主畫面，像 App 一樣全螢幕開啟，下載題庫後沒有網路也能練習。做法沿用 Self-learning-sys（`docs/APP.md`）。

網址：<https://czpeanut.github.io/JFDO/>

## 怎麼安裝

| 裝置 | 安裝方式 |
|---|---|
| Android（Chrome）、電腦（Chrome／Edge） | 進站約 4 秒會跳出「安裝 JFDO 題庫練習」→ **一鍵安裝** → 系統安裝視窗；或按上方的「安裝 App」 |
| iPhone／iPad（Safari） | 蘋果不開放一鍵安裝 → 視窗顯示圖解：**分享 → 加入主畫面 → 新增** |
| LINE／FB／IG 內建瀏覽器 | 沒辦法安裝 → 視窗引導用系統瀏覽器開啟（LINE 自動帶 `openExternalBrowser=1`） |

- 系統安裝視窗一定要使用者點一下才能叫出（瀏覽器規定），所以最少是「點一下」。
- 「以後再說」3 天內不再跳出；「不要再提醒」就不再出現（存在該裝置）。作答中不會跳出。
- iPhone 一定要用 Safari 才有「加入主畫面」。

## 離線使用

「學習進度」頁 →「App 與離線使用」→ **下載題庫供離線使用**（約 17 MB、2777 個檔案）。下載後沒有網路時：

- 首頁、錯題本、學習進度、學習習慣、作答頁都打得開（頁面與換頁資料由 Service Worker 快取）
- 題目、答案、詳解圖從離線題庫取
- 練習紀錄本來就存在裝置上，不受影響
- 「問 AI」需要網路（GitHub Pages 版本來就沒有這個功能）

沒有按下載也會邊用邊存：看過的題目圖會留在快取裡。

## 實作

| 檔案 | 內容 |
|---|---|
| `app/manifest.ts` | 名稱、圖示（含 Android 自適應 maskable）、全螢幕 standalone、主題色、長按圖示的捷徑（錯題本、學習進度）；網址都帶部署路徑（`/JFDO`） |
| `public/sw.js` | Service Worker：程式與圖示快取優先；題庫圖快取優先；題庫索引、頁面、換頁資料（Next.js RSC）網路優先＋斷線用快取；`api/*` 不快取 |
| `lib/offline.ts` | 一次下載整個題庫到快取（與 Service Worker 共用 `jfdo-bank`）、查詢已存數量、刪除 |
| `components/InstallApp.tsx` | 依裝置顯示一鍵安裝或圖解（導覽列按鈕、學習進度頁區塊、進站跳窗）；已安裝就隱藏 |
| `components/RegisterSW.tsx`、`lib/install-script.ts` | 註冊 Service Worker；在 React 載入前先接住 Chrome 的安裝事件 |
| `public/icons/` | 由 `scripts/make_icons.py` 產生（v2 主色底＋JFDO 字樣＋四角對位標記） |

- 需要 **HTTPS**（GitHub Pages、Vercel 預設都是）才能安裝；`localhost` 也可以測試。
- 改版時把 `public/sw.js` 的 `VERSION` 加一，舊的程式／頁面快取會自動清掉（離線題庫保留）。題庫更新時索引走網路優先，會拿到新版；圖片檔名相同但內容改了的話，請學生在學習進度頁「刪除離線題庫」再重新下載。

## 之後要上架商店的話

| 目標 | 做法 | 備註 |
|---|---|---|
| Google Play | 用 **PWABuilder**（<https://www.pwabuilder.com>，輸入網址）或 **Bubblewrap** 把 PWA 包成 TWA | 幾乎不用改程式；要在網站根目錄放 `/.well-known/assetlinks.json` 證明網站是你的——GitHub Pages 的專案網站在 `/JFDO` 底下放不到根目錄，要改用自訂網域或 Vercel；Play 開發者帳號一次 US$25 |
| Apple App Store | 用 **Capacitor** 包成原生殼 | 蘋果審核（Guideline 4.2）常退「只是網頁包殼」的 App，要加原生功能（推播提醒複習、相機拍題…）較容易過；Apple 開發者帳號 US$99／年 |

建議順序：先用 PWA（現在就能裝）→ 需要商店曝光再做 Google Play（TWA 成本最低）→ 最後才考慮 App Store。
