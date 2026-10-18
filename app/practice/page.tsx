'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'
import QuestionPanel, { type Result } from '@/components/QuestionPanel'
import QImages from '@/components/QImages'
import { LevelBadge, ProgressBar, fmtPct } from '@/components/ui'
import { leafOf, leafPath } from '@/lib/bank'
import { collectProfile } from '@/lib/profile-data'
import { getPrefs, getSession, getStats, recordAnswer, saveSession } from '@/lib/storage'
import type { Bank, BankQuestion, Session } from '@/lib/types'
import { useBank } from '@/lib/use-bank'

export default function PracticePage() {
  return <Suspense><Practice /></Suspense>
}

function Practice() {
  const id = useSearchParams().get('id') ?? ''
  const router = useRouter()
  const { bank, error } = useBank()
  const [s, setS] = useState<Session | null | undefined>(undefined)
  const [calm, setCalm] = useState(false)
  useEffect(() => { setS(getSession(id)) }, [id])
  // 冷靜作答：設定開啟，或「自動」且學習習慣偵測到衝動型作答
  useEffect(() => {
    if (!bank) return
    const pref = getPrefs().calm
    setCalm(pref === 'on' || (pref === 'auto' && collectProfile(bank).calmMode))
  }, [bank])

  const byId = useMemo(() => new Map((bank?.questions ?? []).map(q => [q.id, q])), [bank])
  if (error) return <div className="p-6 text-red-600">{error}</div>
  if (s === undefined || !bank) return <div className="p-6 text-ink-muted">載入中…</div>
  if (!s) return <div className="space-y-3 p-6"><div>找不到這組練習。</div><Link href="/" className="btn-primary">回首頁</Link></div>

  const items = s.items.filter(it => byId.has(it.qid))
  const finished = !!s.endedAt || s.index >= items.length
  if (finished) return <Summary s={s} bank={bank} byId={byId} />

  const item = items[s.index]
  const q = byId.get(item.qid)!
  const update = (next: Session) => { saveSession(next); setS(next) }
  const onResult = (r: Result) => {
    recordAnswer(q, r.response, r.correct, r.ms, r.confidence)
    update({ ...s, items: s.items.map(it => it.qid === q.id ? { ...it, response: r.response, correct: r.correct, ms: r.ms, confidence: r.confidence, answeredAt: Date.now() } : it) })
  }
  const next = () => {
    const i = s.index + 1
    const now = Date.now()
    // 記下看答案與詳解多久（學習行為剖析：答錯後有沒有看詳解）；超過 10 分鐘視為離開，不記
    const its = s.items.map(it => it.qid === item.qid && it.answeredAt && it.reviewMs == null && now - it.answeredAt < 600000 ? { ...it, reviewMs: now - it.answeredAt } : it)
    update({ ...s, items: its, index: i, ...(i >= items.length ? { endedAt: now } : {}) })
    window.scrollTo({ top: 0 })
  }
  const answered = items.filter(it => it.correct !== undefined)
  const p = leafPath(bank, leafOf(q))

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="no-print flex items-center gap-3">
        <button className="btn-ghost px-3 py-1.5" onClick={() => router.push(s.mode === 'review' ? '/wrong-book' : '/')}>⏸ 暫停</button>
        <div className="flex-1">
          <div className="flex justify-between text-xs text-ink-muted">
            <span>{s.title}</span>
            <span className="tabular-nums">第 {s.index + 1} / {items.length} 題 · 答對 {answered.filter(a => a.correct).length}</span>
          </div>
          <ProgressBar value={s.index + (item.correct !== undefined ? 1 : 0)} max={items.length} className="mt-1" />
        </div>
      </div>
      <div className="text-xs text-ink-muted">{[p.section, p.sub, p.type].filter(Boolean).join(' › ')}<span className="ml-2 opacity-70">原文件第 {q.no} 題</span></div>
      <QuestionPanel q={q}
        result={item.correct !== undefined && item.response !== undefined ? { response: item.response, correct: item.correct, ms: item.ms ?? 0, confidence: item.confidence } : undefined}
        onResult={onResult} calm={calm} onNext={next} nextLabel={s.index + 1 >= items.length ? '看結果' : '下一題'} />
    </div>
  )
}

function Summary({ s, bank, byId }: { s: Session; bank: Bank; byId: Map<string, BankQuestion> }) {
  const stats = getStats()
  const done = s.items.filter(it => it.correct !== undefined && byId.has(it.qid))
  const right = done.filter(it => it.correct).length
  const leaves = [...new Set(done.map(it => leafOf(byId.get(it.qid)!)))]
  const wrong = done.filter(it => !it.correct)
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="card p-5 text-center">
        <div className="text-sm text-ink-soft">{s.title}</div>
        <div className="mt-2 text-4xl font-bold tabular-nums">{right} / {done.length}</div>
        <div className="mt-1 text-ink-soft">正確率 {done.length ? fmtPct(right / done.length) : '—'}</div>
      </div>

      <div className="card p-4">
        <div className="mb-2 text-sm font-semibold">題型掌握度變化</div>
        <div className="divide-y divide-black/5">
          {leaves.map(l => {
            const p = leafPath(bank, l)
            const before = s.before[l]
            const after = stats[l]
            const its = done.filter(it => leafOf(byId.get(it.qid)!) === l)
            return (
              <div key={l} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate">{p.type}</div>
                  <div className="truncate text-xs text-ink-muted">{p.sub}</div>
                </div>
                <span className="text-xs tabular-nums text-ink-soft">{its.filter(i => i.correct).length}/{its.length} 對</span>
                <span className="text-xs tabular-nums text-ink-muted">{before == null ? '新' : Math.round(before)} → {after ? Math.round(after.score) : '—'}</span>
                <LevelBadge stat={after} showScore={false} />
              </div>
            )
          })}
        </div>
      </div>

      {wrong.length > 0 && (
        <div className="card space-y-3 p-4">
          <div className="text-sm font-semibold">這次錯的題目（已收進錯題本）</div>
          {wrong.map(it => {
            const q = byId.get(it.qid)!
            return (
              <details key={it.qid} className="rounded-xl border border-black/5 p-3">
                <summary className="cursor-pointer text-sm text-ink-soft">{leafPath(bank, leafOf(q)).type} · 第 {q.no} 題</summary>
                <QImages srcs={q.img.q} alt="題目" className="mt-2" />
                <div className="mt-2 rounded-lg bg-amber-50/60 p-2"><QImages srcs={q.img.a} alt="答案" /></div>
                <QImages srcs={q.img.s} alt="詳解" className="mt-2" />
              </details>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/" className="btn-primary">回知識點列表</Link>
        <Link href="/wrong-book" className="btn-outline">看錯題本</Link>
      </div>
    </div>
  )
}
