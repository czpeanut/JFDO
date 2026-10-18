'use client'

// 問 AI：看完題庫詳解還是不懂，說出卡在哪裡，AI 帶著題目與詳解圖針對那一步再講一次（最多 5 次）。
// 回答用 student-app 的 SolutionView 渲染（KaTeX 公式＋幾何圖）。同一題的問答存在本機，不重複花 AI 費用。

import { useEffect, useRef, useState } from 'react'
import SolutionView from './SolutionView'
import { STATIC } from '@/lib/base'
import { addAskTurn, getAsk } from '@/lib/storage'
import { QUICK_DOUBTS } from '@/lib/tutor'
import type { AskRecord } from '@/lib/types'
import { useAIStatus } from '@/lib/use-ai-status'

const MAX_TURNS = 5

export default function AskAI({ qid }: { qid: string }) {
  const status = useAIStatus()
  const [rec, setRec] = useState<AskRecord | null>(null)
  const [doubt, setDoubt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [open, setOpen] = useState(false)
  const lastDoubt = useRef('')

  useEffect(() => { const r = getAsk(qid); setRec(r); setOpen(!!r); setDoubt(''); setError(null) }, [qid])
  useEffect(() => {
    if (!loading) return
    setElapsed(0)
    const t = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(t)
  }, [loading])

  const ask = async (text: string) => {
    const t = text.trim()
    if (!t || loading) return
    lastDoubt.current = t
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/ask', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qid, doubt: t, history: (rec?.turns ?? []).map(x => ({ q: x.q, a: x.a })) }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((d as { error?: string }).error ?? 'AI 暫時無法回應')
      setRec(addAskTurn(qid, t, String((d as { reply?: string }).reply ?? '')))
      setDoubt('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 暫時無法回應')
    } finally { setLoading(false) }
  }

  if (STATIC) return null
  if (status && !status.ai) return <div className="v2-mono v2-muted">問 AI 需要設定 GEMINI_API_KEY</div>
  if (!open) {
    return <button className="v2-btn" style={{ width: '100%' }} disabled={!status} onClick={() => setOpen(true)}>詳解看不懂？問 AI</button>
  }
  const turns = rec?.turns ?? []
  return (
    <div className="flex flex-col" style={{ gap: 12, border: '1px solid var(--color-accent-300)', background: 'var(--color-accent-100)', padding: '14px 16px', fontSize: 14 }}>
      <div className="v2-label">ASK AI 問 AI（會看著題目和詳解回答）</div>
      {turns.map((t, i) => (
        <div key={i} className="flex flex-col" style={{ gap: 8, borderTop: i ? '1px solid var(--color-divider)' : 0, paddingTop: i ? 12 : 0 }}>
          <div className="self-end" style={{ background: 'var(--color-accent)', color: '#fff', padding: '8px 12px', maxWidth: '88%' }}>{t.q}</div>
          <div style={{ background: '#fff', border: '1px solid var(--color-divider)', padding: '10px 12px', lineHeight: 1.65 }}><SolutionView>{t.a}</SolutionView></div>
        </div>
      ))}
      {loading && <div className="v2-mono v2-muted">AI 正在看題目和詳解…（{elapsed} 秒，通常 10–40 秒）</div>}
      {error && (
        <div className="flex items-center justify-between" style={{ gap: 8, background: '#fff', border: '1px solid var(--color-accent-900)', padding: '8px 12px', fontSize: 12, color: 'var(--color-accent-900)' }}>
          <span>{error}</span>
          <button className="v2-link" onClick={() => ask(lastDoubt.current)}>重試</button>
        </div>
      )}
      {!loading && (turns.length < MAX_TURNS ? (
        <div className="flex flex-col" style={{ gap: 8 }}>
          <div className="flex flex-wrap" style={{ gap: 6 }}>
            {QUICK_DOUBTS.map(t => <button key={t} className="v2-tag" style={{ background: '#fff' }} onClick={() => ask(t)}>{t}</button>)}
          </div>
          <div className="flex" style={{ gap: 8 }}>
            <input value={doubt} onChange={e => setDoubt(e.target.value)} maxLength={200} placeholder="例：詳解第二行的 2 是從哪裡來的？"
              onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); ask(doubt) } }} className="v2-input" style={{ flex: 1, minWidth: 0 }} />
            <button className="v2-btn v2-btn-primary v2-btn-sm" disabled={!doubt.trim()} onClick={() => ask(doubt)}>問 AI</button>
          </div>
        </div>
      ) : <div className="v2-muted">這題已經問了 {MAX_TURNS} 次，先把詳解抄一遍、隔天再回來試試看。</div>)}
    </div>
  )
}
