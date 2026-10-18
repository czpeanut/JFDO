import type { Metadata, Viewport } from 'next'
import './globals.css'
import Nav from '@/components/Nav'
import ProfileGate from '@/components/ProfileGate'

export const metadata: Metadata = {
  title: 'JFDO 題庫練習',
  description: '國中段考題庫練習：知識點練習進度、依掌握度抽題、錯題本、AI 詳解',
  formatDetection: { telephone: false },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#2a78d6' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body className="min-h-dvh">
        <ProfileGate>
          <Nav />
          <main className="mx-auto max-w-5xl px-4 pb-28 pt-4 sm:pt-6">{children}</main>
        </ProfileGate>
      </body>
    </html>
  )
}
