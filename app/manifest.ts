import type { MetadataRoute } from 'next'

// PWA 設定：讓瀏覽器把網站當成 App 安裝（加到主畫面、全螢幕開啟、有自己的圖示）
// 網址都要帶部署路徑（GitHub Pages 在 /JFDO 底下；Vercel 是根目錄）
export const dynamic = 'force-static'

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `${BASE}/`,
    name: 'JFDO 題庫練習',
    short_name: 'JFDO',
    description: '單位知識數學題庫：知識點練習進度、依掌握度抽題、學測選填、錯題本、詳解',
    lang: 'zh-TW',
    start_url: `${BASE}/`,
    scope: `${BASE}/`,
    display: 'standalone',
    orientation: 'any',
    background_color: '#f2f2f3',
    theme_color: '#f2f2f3',
    categories: ['education'],
    icons: [
      { src: `${BASE}/icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${BASE}/icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${BASE}/icons/maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: '錯題本', url: `${BASE}/wrong-book`, icons: [{ src: `${BASE}/icons/icon-192.png`, sizes: '192x192' }] },
      { name: '學習進度', url: `${BASE}/progress`, icons: [{ src: `${BASE}/icons/icon-192.png`, sizes: '192x192' }] },
    ],
  }
}
