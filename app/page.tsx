'use client'

// 首頁＝知識點練習主控台（版型同 student-app v2 主控台：情境列、統計格、左資料、右今日佇列）

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Corners, DistBar, Empty, LevelText, ScoreBar, Sect, Stat, fmtPct, pad2 } from '@/components/ui'
import { chapterLabel, leafKey, leafPath, leavesOf, progressOf, questionsByLeaf, typeLabel, type Progress } from '@/lib/bank'
import { levelOf } from '@/lib/mastery'
import { lastAttempts, pickQuestions } from '@/lib/practice'
import { startSession } from '@/lib/session'
import { currentProfile, doneIdSet, dueWrong, getAttempts, getPrefs, getStats, setPrefs } from '@/lib/storage'
import type { AttemptLog, BankChapter, KPStat } from '@/lib/types'
import { useBank } from '@/lib/use-bank'

const COUNTS = [5, 10, 15, 20]
const DAY = 86400000

/** 連續練習天數（今天還沒練就從昨天算） */
function streakOf(logs: AttemptLog[]): number {
  const days = new Set(logs.map(a => new Date(a.at).toDateString()))
  const d = new Date()
  if (!days.has(d.toDateString())) d.setTime(d.getTime() - DAY)
  let n = 0
  while (days.has(d.toDateString())) { n++; d.setTime(d.getTime() - DAY) }
  return n
}

export default function Home() {
  const router = useRouter()
  const { bank, error } = useBank()
  const [chapterId, setChapterId] = useState<string | null>(null)
  const [count, setCount] = useState(10)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [stats, setStats] = useState<Record<string, KPStat>>({})
  const [done, setDone] = useState<Set<string>>(new Set())
  const [logs, setLogs] = useState<AttemptLog[]>([])
  const [due, setDue] = useState(0)
  const [name, setName] = useState('')

  useEffect(() => {
    const p = getPrefs()
    setChapterId(p.chapter); setCount(p.count); setOpen(new Set(p.open))
    setStats(getStats()); setDone(doneIdSet()); setDue(dueWrong().length); setName(currentProfile()?.name ?? '')
    setLogs(getAttempts())
  }, [])

  const byLeaf = useMemo(() => (bank ? questionsByLeaf(bank) : new Map()), [bank])
  if (error) return <Empty>{error}</Empty>
  if (!bank) return <div style={{ padding: 24 }}><span className="v2-label">LOADING</span></div>
  if (!bank.chapters.length) return <Empty>題庫是空的：把 PDF 放進 source/ 後執行 python3 scripts/import_pdf.py</Empty>

  const ch = bank.chapters.find(c => c.id === chapterId) ?? bank.chapters[0]
  const prog = (leaves: string[]) => progressOf(leaves, stats, byLeaf, done)
  const all = prog(bank.chapters.flatMap(c => leavesOf(c)))
  const chLeaves = leavesOf(ch).filter(l => (byLeaf.get(l)?.length ?? 0) > 0)
  const selQuestions = [...sel].reduce((n, l) => n + (byLeaf.get(l)?.length ?? 0), 0)
  const start0 = new Date(); start0.setHours(0, 0, 0, 0)
  const today = logs.filter(a => a.at >= start0.getTime())

  const pickChapter = (id: string) => { setChapterId(id); setSel(new Set()); setPrefs({ chapter: id }) }
  const toggleOpen = (key: string) => {
    const n = new Set(open)
    if (n.has(key)) n.delete(key); else n.add(key)
    setOpen(n); setPrefs({ open: [...n] })
  }
  const toggleLeaves = (leaves: string[]) => {
    const n = new Set(sel)
    const allIn = leaves.every(l => n.has(l))
    for (const l of leaves) { if (allIn) n.delete(l); else n.add(l) }
    setSel(n)
  }
  const start = (leaves: string[], n: number, title: string) => {
    const qs = pickQuestions(leaves, byLeaf, stats, lastAttempts(getAttempts()), n)
    if (qs.length) router.push(`/practice?id=${startSession('practice', title, qs)}`)
  }
  const quickSelect = (kind: 'weak' | 'new') =>
    setSel(new Set(chLeaves.filter(l => (kind === 'new' ? !stats[l]?.attempts : levelOf(stats[l]).key === 'weak'))))

  // 今日佇列：本章待加強的題型（分數低的先）→ 還沒練的（照原文件順序）
  const queue = [
    ...chLeaves.filter(l => levelOf(stats[l]).key === 'weak').sort((a, b) => stats[a].score - stats[b].score),
    ...chLeaves.filter(l => !stats[l]?.attempts),
  ]
  const featured = queue[0]
  const rest = queue.slice(1, 6)
  const d = new Date()

  return (
    <div className="v2-enter" style={{ paddingBottom: sel.size ? 70 : 0 }}>
      {/* 情境列 */}
      <div className="v2-ctx">
        <span>{name}</span>
        <span className="sep">|</span>
        <span className="v2-mono">{d.getFullYear()}-{pad2(d.getMonth() + 1)}-{pad2(d.getDate())}</span>
        <span className="sep">|</span>
        <span>連續練習 {streakOf(logs)} 天</span>
        <span style={{ marginLeft: 'auto' }}>
          <Link href="/wrong-book" className="v2-link">{due ? `今天有 ${due} 題錯題要複習 →` : '錯題本'}</Link>
        </span>
      </div>

      {/* 統計格 */}
      <div className="v2-stats">
        <Stat num={today.length} cap="今天作答 TODAY" sub={today.length ? `答對 ${fmtPct(today.filter(a => a.correct).length / today.length)}` : undefined} />
        <Stat num={Math.round((all.done / (all.total || 1)) * 100)} unit="%" cap="題庫完成度 COVERAGE" sub={`${all.done} / ${all.total} 題`} />
        <Stat num={all.attempts ? Math.round((all.correct / all.attempts) * 100) : '—'} unit={all.attempts ? '%' : undefined} cap="累積正確率 ACCURACY" sub={`作答 ${all.attempts} 次`} />
        <Stat num={due} cap="待複習錯題 TO REVIEW" />
        <div className="v2-stat wide" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="cap" style={{ marginTop: 0, marginBottom: 8 }}>題型掌握分布 DISTRIBUTION</div>
          <DistBar p={all} height={9} />
          <div className="v2-mono v2-muted flex justify-between" style={{ marginTop: 6, fontSize: 10 }}>
            <span>待加強 {all.dist.weak}</span><span>進步中 {all.dist.mid}</span><span>已掌握 {all.dist.good}</span>
          </div>
        </div>
      </div>

      {/* 章節 */}
      <div className="v2-filterbar">
        <span className="grp">章節</span>
        {bank.chapters.map(c => (
          <button key={c.id} className={`v2-tag${c.id === ch.id ? ' is-on' : ''}`} onClick={() => pickChapter(c.id)}>{chapterLabel(c)}</button>
        ))}
      </div>

      <div className="v2-cols">
        {/* 左：知識點進度樹 */}
        <div>
          <Sect label="KNOWLEDGE MAP" title="知識點練習進度" sub="勾選題型後開始練習；系統依掌握度抽題，弱的、錯過的、還沒練的多出一些" />
          <div className="flex flex-wrap items-center" style={{ gap: 6, padding: '0 22px 12px' }}>
            <span className="v2-mono v2-muted" style={{ marginRight: 2 }}>快速選擇</span>
            <button className="v2-tag" onClick={() => quickSelect('weak')}>▲ 待加強</button>
            <button className="v2-tag" onClick={() => quickSelect('new')}>○ 還沒練</button>
            <button className="v2-tag" onClick={() => setSel(new Set(chLeaves))}>整章</button>
            {sel.size > 0 && <button className="v2-link v2-mono" onClick={() => setSel(new Set())}>清除</button>}
          </div>
          <ChapterTree ch={ch} open={open} toggleOpen={toggleOpen} sel={sel} toggleLeaves={toggleLeaves} prog={prog} stats={stats}
            count={(l: string) => byLeaf.get(l)?.length ?? 0} start={start} />
        </div>

        {/* 右：今日佇列 */}
        <div>
          <Sect label="TODAY'S QUEUE" title="今天推薦練習" sub={queue.length ? '本章待加強的題型排前面，再來是還沒練的' : '本章每個題型都練過、也沒有待加強的了'} />
          {featured && (() => {
            const p = leafPath(bank, featured)
            return (
              <div className="blueprint" style={{ margin: '4px 22px 0', padding: '15px 16px' }}>
                <div className="flex flex-col" style={{ gap: 9 }}>
                  <div className="flex items-center" style={{ gap: 8 }}>
                    <span className="v2-chip">{p.sub?.split(' ')[0]}</span>
                    <span className="v2-muted truncate" style={{ fontSize: 11 }}>{p.section}</span>
                    <span style={{ marginLeft: 'auto' }}><LevelText stat={stats[featured]} /></span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600, lineHeight: 1.25 }}>{p.type}</div>
                  <ScoreBar stat={stats[featured]} />
                  <div className="v2-mono v2-muted">題庫 {byLeaf.get(featured)?.length ?? 0} 題{stats[featured]?.attempts ? ` · 答對 ${stats[featured].correct}/${stats[featured].attempts}` : ''}</div>
                  <button className="v2-btn v2-btn-primary" onClick={() => start([featured], 5, `${p.sub?.split(' ')[0]} ${p.type}`)}>練這個題型 5 題</button>
                </div>
                <Corners />
              </div>
            )
          })()}
          {rest.length > 0 && (
            <div className="flex flex-col v2-stagger" style={{ padding: '14px 22px 0' }}>
              {rest.map((l, i) => {
                const p = leafPath(bank, l)
                return (
                  <button key={l} onClick={() => start([l], 5, `${p.sub?.split(' ')[0]} ${p.type}`)} className="flex items-center"
                    style={{ gap: 10, padding: '11px 0', borderTop: '1px solid var(--color-divider)', background: 'none', borderLeft: 0, borderRight: 0, borderBottom: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }}>
                    <span className="v2-idx">{pad2(i + 2)}</span>
                    <span className="v2-tag">{p.sub?.split(' ')[0]}</span>
                    <span className="truncate" style={{ flex: 1, minWidth: 0, fontSize: 13 }}>{p.type}</span>
                    <LevelText stat={stats[l]} showScore={false} />
                  </button>
                )
              })}
            </div>
          )}
          <div className="flex" style={{ gap: 8, padding: '18px 22px' }}>
            <Link href="/wrong-book" className="v2-btn v2-btn-primary" style={{ flex: 1 }}>錯題複習{due ? `（${due} 題）` : ''}</Link>
            <button className="v2-btn" onClick={() => start(chLeaves, 10, `${chapterLabel(ch)}・綜合練習`)}>整章綜合 10 題</button>
          </div>
        </div>
      </div>

      {/* 已選範圍 → 開始練習 */}
      {sel.size > 0 && (
        <div className="v2-actionbar no-print">
          <span style={{ fontSize: 14 }}>已選 <b>{sel.size}</b> 個題型 <span className="v2-mono v2-muted">（題庫 {selQuestions} 題）</span></span>
          <span className="flex items-center" style={{ gap: 4 }}>
            <span className="v2-mono v2-muted">出</span>
            {COUNTS.map(n => <button key={n} className={`v2-tag${count === n ? ' is-on' : ''}`} onClick={() => { setCount(n); setPrefs({ count: n }) }}>{n}</button>)}
            <span className="v2-mono v2-muted">題</span>
          </span>
          <button className="v2-btn v2-btn-primary v2-btn-sm" style={{ marginLeft: 'auto', padding: '10px 22px' }}
            onClick={() => start([...sel], count, `${chapterLabel(ch)}・${sel.size} 個題型`)}>開始練習 →</button>
        </div>
      )}
    </div>
  )
}

function Check({ on, partial = false, onClick }: { on: boolean; partial?: boolean; onClick: () => void }) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick() }} role="checkbox" aria-checked={on ? true : partial ? 'mixed' : false}
      className={`v2-check${on ? ' is-on' : partial ? ' is-partial' : ''}`}>{on ? '✓' : partial ? '–' : ''}</button>
  )
}

function ProgressCells({ p, stat, action }: { p: Progress; stat?: KPStat; action?: React.ReactNode }) {
  return (
    <span className="cells">
      <span style={{ flex: 1, minWidth: 60 }}>{stat !== undefined || p.leaves === 1 ? <ScoreBar stat={stat ?? p.stat} /> : <DistBar p={p} />}</span>
      <span className="v2-mono v2-muted" style={{ width: 56, textAlign: 'right' }}>{p.done}/{p.total}</span>
      <span style={{ width: 72, textAlign: 'right' }}><LevelText stat={stat ?? p.stat} showScore={false} /></span>
      <span style={{ width: 40, textAlign: 'right' }}>{action}</span>
    </span>
  )
}

function ChapterTree({ ch, open, toggleOpen, sel, toggleLeaves, prog, stats, count, start }: {
  ch: BankChapter; open: Set<string>; toggleOpen: (k: string) => void; sel: Set<string>; toggleLeaves: (l: string[]) => void
  prog: (l: string[]) => Progress; stats: Record<string, KPStat>; count: (l: string) => number
  start: (leaves: string[], n: number, title: string) => void
}) {
  const playBtn = (leaf: string, title: string) => (
    <button className="v2-link v2-mono" disabled={!count(leaf)} onClick={() => start([leaf], 5, title)} title="馬上練這個題型 5 題">練 ▶</button>
  )
  return (
    <div>
      {ch.sections.map(s => {
        const sKey = `${ch.id}|${s.id}`
        const sLeaves = leavesOf(ch, { section: s.id })
        const isOpen = open.has(sKey)
        return (
          <div key={s.id}>
            <button className="v2-tree-row" onClick={() => toggleOpen(sKey)} aria-expanded={isOpen} style={isOpen ? { background: 'var(--color-accent-100)' } : undefined}>
              <span className="v2-mono v2-muted" style={{ width: 12 }}>{isOpen ? '▾' : '▸'}</span>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 600 }}>{s.id} {s.title}</span>
              <ProgressCells p={prog(sLeaves)} />
            </button>
            {isOpen && s.kps.map(kp => {
              const kpLeaves = leavesOf(ch, { section: s.id, kp: kp.id })
              return (
                <div key={kp.id}>
                  <div className="v2-tree-row" style={{ '--depth': 1 } as React.CSSProperties}>
                    <Check on={kpLeaves.every(l => sel.has(l))} partial={kpLeaves.some(l => sel.has(l))} onClick={() => toggleLeaves(kpLeaves)} />
                    <span style={{ fontWeight: 600, color: 'var(--color-accent-800)' }}>知識點 {kp.id}：{kp.title}</span>
                    <ProgressCells p={prog(kpLeaves)} />
                  </div>
                  {kp.subs.map(sub => {
                    const subLeaves = sub.types.map(t => leafKey(ch.id, sub.id, t.id))
                    const flat = sub.types.length === 1 && sub.types[0].id === 'T0'
                    return (
                      <div key={sub.id}>
                        <div className="v2-tree-row" style={{ '--depth': 2 } as React.CSSProperties}>
                          <Check on={subLeaves.every(l => sel.has(l))} partial={subLeaves.some(l => sel.has(l))} onClick={() => toggleLeaves(subLeaves)} />
                          <span style={{ fontSize: 14, fontWeight: 500 }}><span className="v2-mono v2-muted" style={{ marginRight: 6 }}>{sub.id}</span>{sub.title}</span>
                          {flat ? <ProgressCells p={prog(subLeaves)} stat={stats[subLeaves[0]]} action={playBtn(subLeaves[0], `${sub.id} ${sub.title}`)} />
                            : <ProgressCells p={prog(subLeaves)} />}
                        </div>
                        {!flat && sub.types.map(t => {
                          const leaf = leafKey(ch.id, sub.id, t.id)
                          return (
                            <div key={t.id} className="v2-tree-row" style={{ '--depth': 3.5, paddingTop: 8, paddingBottom: 8 } as React.CSSProperties}>
                              <Check on={sel.has(leaf)} onClick={() => toggleLeaves([leaf])} />
                              <span style={{ fontSize: 13, color: 'rgba(29,31,32,.8)' }}>{typeLabel(t.id, t.title)}</span>
                              <ProgressCells p={prog([leaf])} stat={stats[leaf]} action={playBtn(leaf, `${sub.id} ${typeLabel(t.id, t.title)}`)} />
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )
      })}
      <div style={{ borderBottom: '1px solid var(--color-divider)' }} />
    </div>
  )
}
