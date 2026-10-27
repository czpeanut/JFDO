import type { Metadata, Viewport } from 'next'
import './globals.css'
import './industry.css'
import Shell from '@/components/Nav'
import ProfileGate from '@/components/ProfileGate'
import RegisterSW from '@/components/RegisterSW'
import { EARLY_CAPTURE_SCRIPT } from '@/lib/install-script'

// 圖示網址要帶部署路徑（GitHub Pages 在 /JFDO 底下）；manifest 由 app/manifest.ts 產生
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export const metadata: Metadata = {
  title: 'JFDO 題庫練習',
  description: '單位知識題庫練習：知識點練習進度、依掌握度抽題、學測選填、錯題本、詳解',
  applicationName: 'JFDO 題庫練習',
  // iPhone「加入主畫面」後全螢幕開啟、狀態列配色、主畫面名稱
  appleWebApp: { capable: true, title: 'JFDO', statusBarStyle: 'default' },
  icons: {
    icon: [{ url: `${BASE}/icons/favicon-32.png`, sizes: '32x32', type: 'image/png' }, { url: `${BASE}/icons/icon-192.png`, sizes: '192x192', type: 'image/png' }],
    apple: [{ url: `${BASE}/icons/apple-touch-icon.png`, sizes: '180x180' }],
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f2f2f3', viewportFit: 'cover' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <head>
        {/* 舊版 iOS 要這個才會全螢幕開啟（Next 15 只輸出新版的 mobile-web-app-capable） */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <script dangerouslySetInnerHTML={{ __html: EARLY_CAPTURE_SCRIPT }} />
      </head>
      <body>
        <RegisterSW />
        <ProfileGate>
          <Shell>{children}</Shell>
        </ProfileGate>
      </body>
    </html>
  )
}
