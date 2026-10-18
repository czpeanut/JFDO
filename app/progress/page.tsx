'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Empty, LevelBadge, MasteryBar, fmtDate, fmtDay, fmtPct } from '@/components/ui'
import { chapterLabel, leafPath, leavesOf, progressOf, questionsByLeaf } from '@/lib/bank'
import { lastAttempts, pickQuestions } from '@/lib/practice'
import { startSession } from '@/lib/session'
import { doneIdSet, exportData, getAttempts, getFlags, getSessions, getStats, importData, removeFlag } from '@/lib/storage'
import type { AttemptLog, FlagItem, KPStat, Session } from '@/lib/types'
import { useBank } from '@/lib/use-bank'

const DAY = 86400000

export default function ProgressPage() {
  const router = useRouter()
  const { bank } = useBank()
  const [stats, setStats] = useState<Record<string, KPStat>>({})
  const [logs, setLogs] = useState<AttemptLog[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [flags, setFlags] = useState<FlagItem[]>([])
  const [done, setDone] = useState<Set<string>>(new Set())
  const load = () => { setStats(getStats()); setLogs(getAttempts()); setSessions(getSessions()); setFlags(getFlags()); setDone(doneIdSet()) }
  useEffect(load, [])

  const byLeaf = useMemo(() => (bank ? questionsByLeaf(bank) : new Map()), [bank])
  if (!bank) return <div className="p-6 text-ink-muted">載入中…</div>

  const prog = (leaves: string[]) => progressOf(leaves, stats, byLeaf, done)
  // 最弱的題型：練過、掌握度最低
  const weakest = Object.entries(stats).filter(([k, s]) => s.attempts > 0 && byLeaf.has(k)).sort((a, b) => a[1].score - b[1].score).slice(0, 8)
  // 近 14 天每天作答數
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const days = Array.from({ length: 14 }, (_, i) => {
    const t0 = start.getTime() - (13 - i) * DAY
    const d = logs.filter(a => a.at >= t0 && a.at < t0 + DAY)
    return { t0, n: d.length, right: d.filter(a => a.correct).length }
  })
  const maxN = Math.max(1, ...days.map(d => d.n))

  const practiceLeaf = (leaf: string) => {
    const qs = pickQuestions([leaf], byLeaf, stats, lastAttempts(logs), 5)
    if (qs.length) router.push(`/practice?id=${startSession('practice', `加強：${leafPath(bank, leaf).type}`, qs)}`)
  }
  const download = () => {
    const blob = new Blob([exportData()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `jfdo-備份-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }
  const upload = (f: File | undefined) => {
    if (!f) return
    f.text().then(t => { if (importData(t)) { alert('已匯入'); load() } else alert('檔案格式不對') })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">學習進度</h1>

      <section className="card p-4">
        <div className="mb-3 text-sm font-semibold">近 14 天作答量</div>
        <div className="flex items-end gap-1">
          {days.map(d => (
            <div key={d.t0} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${fmtDay(d.t0)}：${d.n} 題，答對 ${d.right}`}>
              <div className="text-[10px] tabular-nums text-ink-soft">{d.n || ''}</div>
              <div className="w-full rounded-t bg-brand-500" style={{ height: d.n ? Math.max(3, Math.round((d.n / maxN) * 96)) : 0 }} />
              <div className="h-px w-full bg-black/10" />
              <div className="text-[10px] tabular-nums text-ink-muted">{new Date(d.t0).getDate()}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="text-sm font-semibold">各章知識點掌握度</div>
        {bank.chapters.map(ch => (
          <div key={ch.id} className="card p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="flex-1 font-semibold">{chapterLabel(ch)}</span>
              <Row p={prog(leavesOf(ch))} />
            </div>
            <div className="space-y-3">
              {ch.sections.map(s => (
                <div key={s.id}>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="flex-1 font-medium">{s.id} {s.title}</span>
                    <Row p={prog(leavesOf(ch, { section: s.id }))} />
                  </div>
                  <div className="ml-4 mt-1 space-y-1">
                    {s.kps.map(kp => (
                      <div key={kp.id} className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                        <span className="flex-1">知識點 {kp.id}：{kp.title}</span>
                        <Row p={prog(leavesOf(ch, { section: s.id, kp: kp.id }))} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="card p-4">
        <div className="mb-2 text-sm font-semibold">最需要加強的題型</div>
        {weakest.length === 0 ? <Empty>還沒有練習紀錄</Empty> : (
          <div className="divide-y divide-black/5">
            {weakest.map(([k, s]) => {
              const p = leafPath(bank, k)
              return (
                <div key={k} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{p.type}</div>
                    <div className="truncate text-xs text-ink-muted">{p.section} › {p.sub}</div>
                  </div>
                  <span className="text-xs tabular-nums text-ink-muted">{s.correct}/{s.attempts} 對</span>
                  <LevelBadge stat={s} />
                  <button className="rounded-lg bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100" onClick={() => practiceLeaf(k)}>練 5 題 ▶</button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="card p-4">
        <div className="mb-2 text-sm font-semibold">練習紀錄</div>
        {sessions.length === 0 ? <Empty>還沒有練習紀錄</Empty> : (
          <div className="divide-y divide-black/5">
            {sessions.slice(0, 20).map(s => {
              const d = s.items.filter(i => i.correct !== undefined)
              return (
                <Link key={s.id} href={`/practice?id=${s.id}`} className="flex flex-wrap items-center gap-2 py-2 text-sm hover:bg-black/[.02]">
                  <span className="w-24 shrink-0 text-xs tabular-nums text-ink-muted">{fmtDate(s.startedAt)}</span>
                  <span className="min-w-0 flex-1 truncate">{s.mode === 'review' ? '🔁 ' : ''}{s.title}</span>
                  <span className="text-xs tabular-nums text-ink-soft">{d.filter(i => i.correct).length}/{d.length} 對{s.endedAt ? '' : `（做到第 ${s.index + 1}/${s.items.length} 題，點這裡繼續）`}</span>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {flags.length > 0 && (
        <section className="card p-4">
          <div className="mb-1 text-sm font-semibold">回報有誤的題目</div>
          <p className="mb-2 text-xs text-ink-muted">把題目 ID 轉給題庫作者檢查。</p>
          <div className="divide-y divide-black/5">
            {flags.map(f => (
              <div key={f.qid} className="flex flex-wrap items-center gap-2 py-1.5 text-xs">
                <code className="rounded bg-black/5 px-1.5 py-0.5">{f.qid}</code>
                <span className="flex-1 text-ink-soft">{f.reason}</span>
                <span className="text-ink-muted">{fmtDay(f.at)}</span>
                <button className="text-ink-muted underline" onClick={() => { removeFlag(f.qid); load() }}>移除</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card space-y-2 p-4">
        <div className="text-sm font-semibold">備份</div>
        <p className="text-xs text-ink-muted">紀錄存在這台裝置的瀏覽器；換裝置或清除瀏覽器資料前，先匯出備份。</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-outline" onClick={download}>匯出備份</button>
          <label className="btn-outline cursor-pointer">匯入備份<input type="file" accept="application/json" className="hidden" onChange={e => upload(e.target.files?.[0])} /></label>
        </div>
      </section>
    </div>
  )
}

function Row({ p }: { p: ReturnType<typeof progressOf> }) {
  return (
    <div className="flex w-full items-center gap-2 sm:w-80">
      <MasteryBar stat={p.stat} className="flex-1" />
      <span className="w-24 text-right text-xs tabular-nums text-ink-muted">{p.done}/{p.total} 題{p.attempts ? ` · ${fmtPct(p.correct / p.attempts)}` : ''}</span>
      <LevelBadge stat={p.stat} showScore={false} />
    </div>
  )
}
