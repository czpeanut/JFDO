'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'
import QuestionPanel, { type Result } from '@/components/QuestionPanel'
import QImages from '@/components/QImages'
import { Corners, LevelText, Sect, Stat, fmtPct, pad2 } from '@/components/ui'
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
  if (error) return <p style={{ padding: 24 }}>{error}</p>
  if (s === undefined || !bank) return <div style={{ padding: 24 }}><span className="v2-label">LOADING</span></div>
  if (!s) return <div className="flex flex-col" style={{ padding: 24, gap: 12 }}><div>找不到這組練習。</div><Link href="/" className="v2-btn v2-btn-primary">回首頁</Link></div>

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

  const leave = () => router.push(s.mode === 'review' ? '/wrong-book' : '/')
  const progressPct = ((s.index + (item.correct !== undefined ? 1 : 0)) / items.length) * 100

  return (
    <div className="v2-enter">
      {/* 頂部列：暫停、標題、進度 */}
      <div className="sticky top-0 z-30 flex items-center" style={{ gap: 12, padding: '12px 22px', borderBottom: '1px solid var(--color-divider)', background: 'var(--color-bg)' }}>
        <button className="v2-btn v2-btn-sm" onClick={leave}>⏸ 暫停</button>
        <div className="min-w-0 flex-1">
          <div className="truncate" style={{ fontSize: 13 }}>{s.mode === 'review' ? '錯題複習・' : ''}{s.title}</div>
          <div className="v2-bar" style={{ height: 4, marginTop: 6 }}>
            <div className="seg-review" style={{ flexGrow: progressPct }} /><div className="seg-empty" style={{ flexGrow: 100 - progressPct }} />
          </div>
        </div>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 20, lineHeight: 1, color: 'var(--color-accent-900)' }}>{pad2(s.index + 1)}<span className="v2-muted" style={{ fontSize: 14 }}> / {pad2(items.length)}</span></span>
      </div>

      <div className="v2-2col">
        <div className="flex flex-col" style={{ padding: '20px 22px', gap: 10 }}>
          <div className="v2-label">QUESTION {pad2(s.index + 1)} · {p.sub?.split(' ')[0]} · 原文件第 {q.no} 題</div>
          <div style={{ fontSize: 13 }} className="v2-muted">{[p.section, p.sub, p.type].filter(Boolean).join(' › ')}</div>
          <QuestionPanel q={q}
            result={item.correct !== undefined && item.response !== undefined ? { response: item.response, correct: item.correct, ms: item.ms ?? 0, confidence: item.confidence } : undefined}
            onResult={onResult} calm={calm} onNext={next} nextLabel={s.index + 1 >= items.length ? '看結果' : '下一題'} />
        </div>

        {/* 右：本回紀錄（桌機）*/}
        <div className="desk-only">
          <Sect label="RUN LOG" title="本回紀錄" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', borderTop: '1px solid var(--color-divider)', borderBottom: '1px solid var(--color-divider)' }}>
            <div style={{ borderRight: '1px solid var(--color-divider)' }}><Stat num={answered.filter(a => a.correct).length} cap="答對 CORRECT" /></div>
            <Stat num={answered.filter(a => !a.correct).length} cap="答錯 WRONG" />
          </div>
          <div className="flex flex-col">
            {items.map((it, i) => {
              const qq = byId.get(it.qid)!
              return (
                <div key={it.qid} className="flex items-center" style={{ gap: 10, padding: '10px 22px', borderBottom: '1px solid var(--color-divider)', background: i === s.index ? 'var(--color-accent-100)' : undefined }}>
                  <span className="v2-idx">{pad2(i + 1)}</span>
                  <span className="truncate" style={{ flex: 1, minWidth: 0, fontSize: 13 }}>{leafPath(bank, leafOf(qq)).type}</span>
                  <span className="v2-mono" style={{ color: it.correct === undefined ? 'rgba(29,31,32,.35)' : it.correct ? 'var(--color-accent-700)' : 'var(--color-accent-900)' }}>
                    {it.correct === undefined ? '—' : it.correct ? '✓' : '✗'}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="v2-muted" style={{ padding: '14px 22px', fontSize: 12 }}>答錯的題目會收進錯題本；題型掌握度依你的把握程度調整。</p>
        </div>
      </div>
    </div>
  )
}

function Summary({ s, bank, byId }: { s: Session; bank: Bank; byId: Map<string, BankQuestion> }) {
  const stats = getStats()
  const done = s.items.filter(it => it.correct !== undefined && byId.has(it.qid))
  const right = done.filter(it => it.correct).length
  const leaves = [...new Set(done.map(it => leafOf(byId.get(it.qid)!)))]
  const wrong = done.filter(it => !it.correct)
  const rate = done.length ? Math.round((right / done.length) * 100) : 0
  return (
    <div className="v2-enter">
      <div className="v2-ctx"><span>{s.mode === 'review' ? '錯題複習' : '練習結果'}</span><span className="sep">|</span><span className="truncate">{s.title}</span></div>
      <div className="v2-stats cols-4">
        <Stat num={right} unit={` / ${done.length}`} cap="答對 CORRECT" />
        <Stat num={rate} unit="%" cap="正確率 ACCURACY" />
        <Stat num={wrong.length} cap="收進錯題本 TO WRONG BOOK" />
        <Stat num={leaves.length} cap="練到的題型 TYPES" />
      </div>

      <div className="v2-2col">
        <div>
          <Sect label="MASTERY DELTA" title="題型掌握度變化" />
          <table className="v2-matrix">
            <thead><tr><th style={{ paddingLeft: 22 }}>題型</th><th>本次</th><th>掌握度</th><th style={{ paddingRight: 22 }}>等級</th></tr></thead>
            <tbody>
              {leaves.map(l => {
                const p = leafPath(bank, l)
                const before = s.before[l]
                const after = stats[l]
                const its = done.filter(it => leafOf(byId.get(it.qid)!) === l)
                return (
                  <tr key={l}>
                    <td style={{ paddingLeft: 22 }}><div style={{ fontSize: 13 }}>{p.type}</div><div className="v2-muted" style={{ fontSize: 11 }}>{p.sub}</div></td>
                    <td className="num">{its.filter(i => i.correct).length}/{its.length}</td>
                    <td className="num">{before == null ? '新' : Math.round(before)} → {after ? Math.round(after.score) : '—'}</td>
                    <td style={{ paddingRight: 22 }}><LevelText stat={after} showScore={false} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="flex" style={{ gap: 8, padding: '18px 22px' }}>
            <Link href="/" className="v2-btn v2-btn-primary" style={{ flex: 1 }}>回知識點列表</Link>
            <Link href="/wrong-book" className="v2-btn" style={{ flex: 1 }}>看錯題本</Link>
          </div>
        </div>

        <div>
          <Sect label="WRONG ANSWERS" title="這次錯的題目" sub={wrong.length ? '已收進錯題本，明天開始複習' : '全部答對，太棒了！'} />
          {wrong.map((it, i) => {
            const q = byId.get(it.qid)!
            return (
              <details key={it.qid} style={{ borderTop: '1px solid var(--color-divider)' }}>
                <summary className="flex items-center" style={{ gap: 10, padding: '11px 22px', cursor: 'pointer', fontSize: 13 }}>
                  <span className="v2-idx">{pad2(i + 1)}</span>
                  <span className="truncate" style={{ flex: 1 }}>{leafPath(bank, leafOf(q)).type}</span>
                  <span className="v2-mono v2-muted">第 {q.no} 題</span>
                </summary>
                <div className="flex flex-col" style={{ gap: 10, padding: '0 22px 16px' }}>
                  <div className="blueprint v2-paper"><QImages srcs={q.img.q} alt="題目" /><Corners /></div>
                  {q.img.a?.length ? <div className="v2-paper" style={{ border: '1px solid var(--color-divider)' }}><QImages srcs={q.img.a} alt="答案" /></div> : null}
                  <div className="v2-paper" style={{ border: '1px solid var(--color-divider)' }}><QImages srcs={q.img.s} alt="詳解" /></div>
                </div>
              </details>
            )
          })}
          {wrong.length > 0 && <div style={{ borderBottom: '1px solid var(--color-divider)' }} />}
          <p className="v2-muted" style={{ padding: '12px 22px', fontSize: 12 }}>正確率 {done.length ? fmtPct(right / done.length) : '—'}</p>
        </div>
      </div>
    </div>
  )
}
