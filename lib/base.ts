// 部署路徑：GitHub Pages 放在 /JFDO 底下（NEXT_PUBLIC_BASE_PATH），Vercel／本機是根目錄。
// next/link、router 會自動加 basePath；自己組的網址（題庫圖片、index.json）要用 withBase。
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
export const withBase = (p: string) => `${BASE}${p}`
/** 靜態網頁版（GitHub Pages）：沒有伺服器，不能問 AI */
export const STATIC = process.env.NEXT_PUBLIC_STATIC === '1'
