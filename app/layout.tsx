import type { Metadata, Viewport } from 'next'
import './globals.css'
import './industry.css'
import Shell from '@/components/Nav'
import ProfileGate from '@/components/ProfileGate'

export const metadata: Metadata = {
  title: 'JFDO 題庫練習',
  description: '單位知識題庫練習：知識點練習進度、依掌握度抽題、錯題本、詳解與問 AI',
  formatDetection: { telephone: false },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f2f2f3', viewportFit: 'cover' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body>
        <ProfileGate>
          <Shell>{children}</Shell>
        </ProfileGate>
      </body>
    </html>
  )
}
