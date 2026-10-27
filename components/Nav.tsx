'use client'

// 介面外殼（版型沿用 czpeanut/student-app 的 app/v2/layout.tsx）：
//   桌機（≥900px）＝ 指令列（品牌＋橫向分頁）
//   手機          ＝ 頂部身分列 ＋ 底部導航
// 作答頁只留內容（減少分心，作答頁自己有「暫停」）。

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import InstallApp, { InstallPopup } from './InstallApp'
import { withBase } from '@/lib/base'
import { currentProfile, dueWrong, switchProfile } from '@/lib/storage'

const NAV = [
  { href: '/', label: '知識點練習', short: '練習', exact: true },
  { href: '/wrong-book', label: '錯題本', short: '錯題本', exact: false },
  { href: '/progress', label: '學習進度', short: '進度', exact: false },
  { href: '/habits', label: '學習習慣', short: '習慣', exact: false },
]

const plainBtn: React.CSSProperties = { background: 'none', border: 0, cursor: 'pointer', color: 'rgba(29,31,32,.55)', padding: 0 }

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const navRef = useRef<HTMLElement>(null)
  const [name, setName] = useState('')
  const [due, setDue] = useState(0)
  useEffect(() => { setName(currentProfile()?.name ?? ''); setDue(dueWrong().length) }, [path])

  // 量底部導航實際高度（含 safe-area）寫入 --bottom-nav-h，內容與動作列留白用；桌機導航隱藏 → 0
  const inPractice = path.startsWith('/practice')
  useEffect(() => {
    const el = navRef.current
    if (!el) { document.documentElement.style.setProperty('--bottom-nav-h', '0px'); return }
    const setVar = () => document.documentElement.style.setProperty('--bottom-nav-h', `${el.offsetHeight}px`)
    setVar()
    const ro = new ResizeObserver(setVar)
    ro.observe(el)
    window.addEventListener('resize', setVar)
    return () => { ro.disconnect(); window.removeEventListener('resize', setVar) }
  }, [inPractice])

  if (inPractice) return <div className="v2-root app-shell" style={{ minHeight: '100dvh' }}>{children}</div>

  const initial = name.trim().charAt(0) || '學'
  const isActive = (href: string, exact: boolean) => exact ? path === href : path.startsWith(href)
  const signOut = () => { switchProfile(null); window.location.href = withBase('/') }

  return (
    <div className="v2-root app-shell flex flex-col" style={{ minHeight: '100dvh' }}>
      {/* 桌機：指令列 */}
      <header className="v2-cmdbar sticky top-0 z-30">
        <Link href="/" className="v2-brand" style={{ color: 'inherit' }}><span className="mark" />JFDO 題庫練習</Link>
        {NAV.map(({ href, label, exact }) => (
          <Link key={href} href={href} className={`v2-tab${isActive(href, exact) ? ' is-active' : ''}`}>
            {label}
            {href === '/wrong-book' && due > 0 && <span className="v2-mono" style={{ marginLeft: 6, padding: '0 5px', background: 'var(--color-accent-900)', color: '#fff' }}>{due}</span>}
          </Link>
        ))}
        <div className="flex items-center" style={{ marginLeft: 'auto', gap: 14, padding: '0 22px' }}>
          <span className="flex items-center" style={{ gap: 8 }}>
            <span className="flex items-center justify-center" style={{ width: 26, height: 26, background: 'var(--color-accent)', color: '#fff', fontFamily: 'var(--font-heading)', fontSize: 13 }}>{initial}</span>
            <span style={{ fontSize: 14 }}>{name}</span>
          </span>
          <InstallApp />
          <button onClick={signOut} className="v2-mono" style={plainBtn} title="切換學生">切換學生</button>
        </div>
      </header>

      {/* 手機：身分列 */}
      <header className="v2-mobile-header sticky top-0 z-30 flex items-center"
        style={{ gap: 10, flexShrink: 0, borderBottom: '1px solid var(--color-divider)', background: 'var(--color-bg)', padding: '14px 18px 12px' }}>
        <span className="flex items-center justify-center" style={{ width: 30, height: 30, background: 'var(--color-accent)', color: '#fff', fontFamily: 'var(--font-heading)', fontSize: 15 }}>{initial}</span>
        <div className="min-w-0">
          <div style={{ fontSize: 15, fontWeight: 500 }} className="truncate">{name}</div>
          <div className="v2-mono v2-muted" style={{ fontSize: 10, letterSpacing: '0.08em' }}>JFDO 題庫練習</div>
        </div>
        <span className="ml-auto flex items-center" style={{ gap: 12 }}>
          <InstallApp />
          <button onClick={signOut} className="v2-mono" style={plainBtn}>切換學生</button>
        </span>
      </header>

      <main className="flex-1 min-w-0" style={{ paddingBottom: 'max(1.5rem, calc(var(--bottom-nav-h, 0px) + 1rem))' }}>
        {children}
      </main>

      <InstallPopup />

      {/* 手機：底部導航 */}
      <nav ref={navRef} className="v2-nav fixed bottom-0 left-0 right-0 z-40" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {NAV.map(({ href, short, exact }) => (
          <Link key={href} href={href} className={isActive(href, exact) ? 'is-active' : undefined}>
            <span className="tick" />
            {short}{href === '/wrong-book' && due > 0 ? ` ${due}` : ''}
          </Link>
        ))}
      </nav>
    </div>
  )
}
