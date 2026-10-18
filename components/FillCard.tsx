'use client'

// 學測選填：題目的答案式先印好（分數線、根號、文字），數字位置是編號格 1、2、3…；
// 學生在答案卡上每格填一個數字或負號（點格子＋數字鍵盤，或直接用鍵盤），整題全對才算對。

import { useEffect, useState } from 'react'
import TeX, { filledTex } from './TeX'
import type { FillSpec } from '@/lib/types'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-']
/** 格子編號：與答案式裡的方格編號相同 */
export const slotName = (i: number) => String(i + 1)
const show = (c: string | undefined) => (c === '-' ? '−' : c ?? '')

export function slotCount(fill: FillSpec) { return fill.parts.reduce((n, p) => n + p.key.length, 0) }

/** 答案格式（題目上印好的式子）；filled 給了就顯示學生填的字 */
export function FillFormat({ fill, filled }: { fill: FillSpec; filled?: (string | undefined)[] }) {
  return (
    <div className="flex flex-col" style={{ gap: 6 }}>
      {fill.parts.map((p, i) => (
        <div key={i} className="flex flex-wrap items-center" style={{ gap: 10, fontSize: 17 }}>
          {p.label && <span className="v2-mono v2-muted">{p.label}</span>}
          <TeX tex={filled ? filledTex(p.tex, filled) : p.tex} />
        </div>
      ))}
    </div>
  )
}

export default function FillCard({ fill, filled, onChange, disabled = false }: {
  fill: FillSpec; filled: string[]; onChange: (v: string[]) => void; disabled?: boolean
}) {
  const n = slotCount(fill)
  const [at, setAt] = useState(0)
  useEffect(() => setAt(0), [fill])

  const put = (c: string) => {
    if (disabled) return
    const v = Array.from({ length: n }, (_, i) => filled[i] ?? '')
    v[at] = c
    onChange(v)
    if (at < n - 1) setAt(at + 1)
  }
  const back = () => {
    if (disabled) return
    const v = Array.from({ length: n }, (_, i) => filled[i] ?? '')
    const i = v[at] ? at : Math.max(0, at - 1)
    v[i] = ''
    onChange(v); setAt(i)
  }

  // 實體鍵盤：數字、負號、退格、左右鍵
  useEffect(() => {
    if (disabled) return
    const onKey = (e: KeyboardEvent) => {
      const t = (e.target as HTMLElement)?.tagName
      if (t === 'INPUT' || t === 'TEXTAREA') return
      if (/^[0-9]$/.test(e.key)) put(e.key)
      else if (e.key === '-' || e.key === '−') put('-')
      else if (e.key === 'Backspace') back()
      else if (e.key === 'ArrowLeft') setAt(a => Math.max(0, a - 1))
      else if (e.key === 'ArrowRight') setAt(a => Math.min(n - 1, a + 1))
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="flex flex-col" style={{ gap: 12 }}>
      <div className="v2-label">FILL-IN 選填（每格填一個數字或負號，整題全對才算對）</div>
      <div className="blueprint" style={{ padding: '14px 16px' }}>
        <FillFormat fill={fill} filled={filled.map(c => c || undefined)} />
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      </div>
      <div className="flex flex-wrap" style={{ gap: 8 }}>
        {Array.from({ length: n }, (_, i) => (
          <button key={i} onClick={() => setAt(i)} disabled={disabled} aria-label={`第 ${i + 1} 格`}
            className="flex flex-col items-center" style={{ gap: 2, background: 'none', border: 0, padding: 0, cursor: 'pointer' }}>
            <span className="v2-mono v2-muted" style={{ fontSize: 11 }}>{slotName(i)}</span>
            <span style={{
              width: 40, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-heading)', fontSize: 22, background: '#fff',
              border: `${at === i && !disabled ? 2 : 1}px solid ${at === i && !disabled ? 'var(--color-accent)' : 'var(--color-divider-strong)'}`,
            }}>{show(filled[i])}</span>
          </button>
        ))}
      </div>
      {!disabled && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 6, maxWidth: 360 }}>
          {KEYS.map(k => <button key={k} className="v2-btn v2-btn-sm" style={{ fontSize: 18, padding: '9px 0' }} onClick={() => put(k)}>{show(k)}</button>)}
          <button className="v2-btn v2-btn-sm" style={{ fontSize: 16, padding: '9px 0' }} onClick={back} aria-label="刪除">⌫</button>
        </div>
      )}
    </div>
  )
}
