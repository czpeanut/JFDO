'use client'

// 學習進度（版型同 student-app v2 弱點分析：四格統計、左掌握矩陣、右清單）

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { DistBar, Empty, LevelText, Sect, Stat, fmtDate, fmtPct, pad2 } from '@/components/ui'
import { chapterLabel, leafPath, leavesOf, progressOf, questionsByLeaf, type Progress } from '@/lib/bank'
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
  if (!bank) return <div style={{ padding: 24 }}><span className="v2-label">LOADING</span></div>

  const prog = (leaves: string[]) => progressOf(leaves, stats, byLeaf, done)
  const all = prog(bank.chapters.flatMap(c => leavesOf(c)))
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
  const row = (key: string, label: React.ReactNode, p: Progress, depth: number) => (
    <tr key={key} className={depth === 0 ? 'is-top' : undefined}>
      <td style={{ paddingLeft: 22 + depth * 16, fontSize: depth === 2 ? 12 : 13, fontWeight: depth === 0 ? 600 : 400 }}>{label}</td>
      <td style={{ width: '28%' }}><DistBar p={p} /></td>
      <td className="num">{p.done}/{p.total}</td>
      <td className="num">{p.attempts ? fmtPct(p.correct / p.attempts) : '—'}</td>
      <td style={{ paddingRight: 22 }}><LevelText stat={p.stat} showScore={false} /></td>
    </tr>
  )

  return (
    <div className="v2-enter">
      <div className="v2-stats cols-4">
        <Stat num={all.attempts} cap="累積作答 ANSWERS" />
        <Stat num={all.attempts ? Math.round((all.correct / all.attempts) * 100) : '—'} unit={all.attempts ? '%' : undefined} cap="正確率 ACCURACY" />
        <Stat num={all.practicedLeaves} unit={` / ${all.leaves}`} cap="練過的題型 TYPES" />
        <Stat num={days.filter(d => d.n > 0).length} unit=" 天" cap="近 14 天練習 ACTIVE DAYS" />
      </div>

      <div className="v2-2col">
        <div>
          <Sect label="MASTERY MATRIX" title="各章知識點掌握度" sub="長條＝各等級的題型數：深＝待加強、中＝進步中、淺＝已掌握、灰＝未練習" />
          <div style={{ overflowX: 'auto' }}>
            <table className="v2-matrix">
              <thead><tr><th style={{ paddingLeft: 22 }}>章節／知識點</th><th>掌握分布</th><th>做過</th><th>正確率</th><th style={{ paddingRight: 22 }}>等級</th></tr></thead>
              <tbody>
                {bank.chapters.flatMap(ch => [
                  row(ch.id, chapterLabel(ch), prog(leavesOf(ch)), 0),
                  ...ch.sections.flatMap(s => [
                    row(`${ch.id}|${s.id}`, `${s.id} ${s.title}`, prog(leavesOf(ch, { section: s.id })), 1),
                    ...s.kps.map(kp => row(`${ch.id}|${s.id}|${kp.id}`, `知識點 ${kp.id}：${kp.title}`, prog(leavesOf(ch, { section: s.id, kp: kp.id })), 2)),
                  ]),
                ])}
              </tbody>
            </table>
          </div>

          <Sect label="ACTIVITY" title="近 14 天作答量" />
          <div className="flex items-end" style={{ gap: 4, padding: '0 22px 20px' }}>
            {days.map(d => (
              <div key={d.t0} className="flex min-w-0 flex-1 flex-col items-center" style={{ gap: 4 }} title={`${new Date(d.t0).getMonth() + 1}/${new Date(d.t0).getDate()}：${d.n} 題，答對 ${d.right}`}>
                <span className="v2-mono v2-muted" style={{ fontSize: 10 }}>{d.n || ''}</span>
                <div style={{ width: '100%', height: d.n ? Math.max(3, Math.round((d.n / maxN) * 96)) : 0, background: 'var(--color-accent)' }} />
                <div style={{ width: '100%', height: 1, background: 'var(--color-divider)' }} />
                <span className="v2-mono v2-muted" style={{ fontSize: 10 }}>{pad2(new Date(d.t0).getDate())}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Sect label="FOCUS" title="最需要加強的題型" />
          {weakest.length === 0 ? <Empty>還沒有練習紀錄</Empty> : (
            <div className="flex flex-col v2-stagger">
              {weakest.map(([k, s], i) => {
                const p = leafPath(bank, k)
                return (
                  <div key={k} className="flex items-center" style={{ gap: 10, padding: '11px 22px', borderTop: '1px solid var(--color-divider)' }}>
                    <span className="v2-idx">{pad2(i + 1)}</span>
                    <span className="min-w-0" style={{ flex: 1 }}>
                      <span className="truncate" style={{ display: 'block', fontSize: 13 }}>{p.type}</span>
                      <span className="v2-muted" style={{ fontSize: 11 }}>{p.sub} · {s.correct}/{s.attempts} 對</span>
                    </span>
                    <LevelText stat={s} />
                    <button className="v2-link v2-mono" onClick={() => practiceLeaf(k)}>練 5 題 ▶</button>
                  </div>
                )
              })}
              <div style={{ borderBottom: '1px solid var(--color-divider)' }} />
            </div>
          )}

          <Sect label="SESSIONS" title="練習紀錄" />
          {sessions.length === 0 ? <Empty>還沒有練習紀錄</Empty> : (
            <div className="flex flex-col">
              {sessions.slice(0, 20).map(s => {
                const d = s.items.filter(i => i.correct !== undefined)
                return (
                  <Link key={s.id} href={`/practice?id=${s.id}`} className="flex items-center"
                    style={{ gap: 10, padding: '10px 22px', borderTop: '1px solid var(--color-divider)', color: 'inherit', textDecoration: 'none' }}>
                    <span className="v2-mono v2-muted" style={{ width: 82, flexShrink: 0 }}>{fmtDate(s.startedAt)}</span>
                    <span className="truncate" style={{ flex: 1, minWidth: 0, fontSize: 13 }}>{s.mode === 'review' ? '錯題・' : ''}{s.title}</span>
                    <span className="v2-mono" style={{ color: s.endedAt ? 'var(--color-accent-700)' : 'var(--color-accent-900)' }}>
                      {s.endedAt ? `${d.filter(i => i.correct).length}/${d.length}` : `繼續 ${s.index + 1}/${s.items.length}`}
                    </span>
                  </Link>
                )
              })}
              <div style={{ borderBottom: '1px solid var(--color-divider)' }} />
            </div>
          )}

          {flags.length > 0 && (
            <>
              <Sect label="REPORTED" title="回報有誤的題目" sub="把題目 ID 轉給題庫作者檢查" />
              {flags.map(f => (
                <div key={f.qid} className="flex flex-wrap items-center" style={{ gap: 8, padding: '9px 22px', borderTop: '1px solid var(--color-divider)', fontSize: 12 }}>
                  <code className="v2-mono" style={{ background: '#fff', padding: '1px 6px', border: '1px solid var(--color-divider)' }}>{f.qid}</code>
                  <span className="v2-muted" style={{ flex: 1 }}>{f.reason}</span>
                  <button className="v2-link v2-mono" onClick={() => { removeFlag(f.qid); load() }}>移除</button>
                </div>
              ))}
              <div style={{ borderBottom: '1px solid var(--color-divider)' }} />
            </>
          )}

          <Sect label="BACKUP" title="備份" sub="紀錄存在這台裝置的瀏覽器；換裝置或清除瀏覽器資料前，先匯出備份。" />
          <div className="flex" style={{ gap: 8, padding: '0 22px 22px' }}>
            <button className="v2-btn v2-btn-sm" onClick={download}>匯出備份</button>
            <label className="v2-btn v2-btn-sm" style={{ cursor: 'pointer' }}>匯入備份<input type="file" accept="application/json" className="hidden" onChange={e => upload(e.target.files?.[0])} /></label>
          </div>
        </div>
      </div>
    </div>
  )
}
