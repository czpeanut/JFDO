'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { currentProfile, dueWrong, switchProfile } from '@/lib/storage'

const LINKS = [
  { href: '/', label: '知識點練習' },
  { href: '/wrong-book', label: '錯題本' },
  { href: '/progress', label: '學習進度' },
]

export default function Nav() {
  const path = usePathname()
  const [name, setName] = useState('')
  const [due, setDue] = useState(0)
  useEffect(() => { setName(currentProfile()?.name ?? ''); setDue(dueWrong().length) }, [path])
  // 作答中隱藏導覽，減少分心（右上角有「暫停」可離開）
  if (path.startsWith('/practice')) return null
  return (
    <header className="no-print sticky top-0 z-20 border-b border-black/5 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-4 py-2.5">
        <Link href="/" className="mr-3 shrink-0 font-bold tracking-wide text-brand-600">JFDO 題庫練習</Link>
        {LINKS.map(l => {
          const active = l.href === '/' ? path === '/' : path.startsWith(l.href)
          return (
            <Link key={l.href} href={l.href}
              className={`relative shrink-0 rounded-lg px-3 py-1.5 text-sm ${active ? 'bg-brand-500 text-white' : 'text-ink-soft hover:bg-black/5'}`}>
              {l.label}
              {l.href === '/wrong-book' && due > 0 && <span className="ml-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{due}</span>}
            </Link>
          )
        })}
        {name && (
          <button className="ml-auto shrink-0 rounded-lg px-2 py-1 text-sm text-ink-soft hover:bg-black/5" title="切換學生"
            onClick={() => { switchProfile(null); window.location.href = '/' }}>
            👤 {name} <span className="text-xs text-ink-muted">切換</span>
          </button>
        )}
      </div>
    </header>
  )
}
