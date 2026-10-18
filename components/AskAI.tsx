'use client'

// 問 AI：看完題庫詳解還是不懂，說出卡在哪裡，AI 帶著題目與詳解圖針對那一步再講一次（最多 5 次）。
// 回答用 student-app 的 SolutionView 渲染（KaTeX 公式＋幾何圖）。同一題的問答存在本機，不重複花 AI 費用。

import { useEffect, useRef, useState } from 'react'
import SolutionView from './SolutionView'
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

  if (status && !status.ai) return <div className="text-xs text-ink-muted">🤖 問 AI 需要設定 GEMINI_API_KEY</div>
  if (!open) {
    return <button className="btn-outline w-full" disabled={!status} onClick={() => setOpen(true)}>🤖 詳解看不懂？問 AI</button>
  }
  const turns = rec?.turns ?? []
  return (
    <div className="space-y-3 rounded-xl border border-brand-500/20 bg-brand-50/40 p-4 text-sm">
      <div className="text-xs font-semibold text-brand-700">🤖 問 AI（會看著題目和詳解回答）</div>
      {turns.map((t, i) => (
        <div key={i} className="space-y-2 border-b border-black/5 pb-3 last:border-0">
          <div className="text-ink-soft">🙋 你問：{t.q}</div>
          <div className="leading-relaxed"><SolutionView>{t.a}</SolutionView></div>
        </div>
      ))}
      {loading && <div className="text-ink-muted">🤖 AI 正在看題目和詳解…（{elapsed} 秒，通常 10–40 秒）</div>}
      {error && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          <span>{error}</span>
          <button className="font-medium underline" onClick={() => ask(lastDoubt.current)}>重試</button>
        </div>
      )}
      {!loading && (turns.length < MAX_TURNS ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_DOUBTS.map(t => <button key={t} className="chip border border-black/10 bg-white py-1 text-ink-soft hover:border-brand-500" onClick={() => ask(t)}>{t}</button>)}
          </div>
          <div className="flex gap-2">
            <input value={doubt} onChange={e => setDoubt(e.target.value)} maxLength={200} placeholder="例：詳解第二行的 2 是從哪裡來的？"
              onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); ask(doubt) } }}
              className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 py-1.5 outline-none focus:border-brand-500" />
            <button className="btn-primary px-3 py-1.5" disabled={!doubt.trim()} onClick={() => ask(doubt)}>問 AI</button>
          </div>
        </div>
      ) : <div className="text-ink-muted">這題已經問了 {MAX_TURNS} 次，先把詳解抄一遍、隔天再回來試試看。</div>)}
    </div>
  )
}
