'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Empty, LevelBadge, MasteryBar, Tile, fmtPct } from '@/components/ui'
import { chapterLabel, leafKey, leavesOf, progressOf, questionsByLeaf, typeLabel, type Progress } from '@/lib/bank'
import { levelOf } from '@/lib/mastery'
import { lastAttempts, pickQuestions } from '@/lib/practice'
import { startSession } from '@/lib/session'
import { currentProfile, doneIdSet, dueWrong, getAttempts, getPrefs, getStats, setPrefs } from '@/lib/storage'
import type { BankChapter, KPStat } from '@/lib/types'
import { useBank } from '@/lib/use-bank'

const COUNTS = [5, 10, 15, 20]

export default function Home() {
  const router = useRouter()
  const { bank, error } = useBank()
  const [chapterId, setChapterId] = useState<string | null>(null)
  const [count, setCount] = useState(10)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [stats, setStats] = useState<Record<string, KPStat>>({})
  const [done, setDone] = useState<Set<string>>(new Set())
  const [today, setToday] = useState({ n: 0, right: 0 })
  const [due, setDue] = useState(0)
  const [name, setName] = useState('')

  useEffect(() => {
    const p = getPrefs()
    setChapterId(p.chapter); setCount(p.count); setOpen(new Set(p.open))
    setStats(getStats()); setDone(doneIdSet()); setDue(dueWrong().length); setName(currentProfile()?.name ?? '')
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const t = getAttempts().filter(a => a.at >= start.getTime())
    setToday({ n: t.length, right: t.filter(a => a.correct).length })
  }, [])

  const byLeaf = useMemo(() => (bank ? questionsByLeaf(bank) : new Map()), [bank])
  if (error) return <Empty>{error}</Empty>
  if (!bank) return <div className="p-6 text-ink-muted">題庫載入中…</div>
  if (!bank.chapters.length) return <Empty>題庫是空的：把 PDF 放進 source/ 後執行 python3 scripts/import_pdf.py</Empty>

  const ch = bank.chapters.find(c => c.id === chapterId) ?? bank.chapters[0]
  const prog = (leaves: string[]) => progressOf(leaves, stats, byLeaf, done)
  const all = prog(bank.chapters.flatMap(c => leavesOf(c)))
  const selQuestions = [...sel].reduce((n, l) => n + (byLeaf.get(l)?.length ?? 0), 0)

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
    if (!qs.length) return
    router.push(`/practice?id=${startSession('practice', title, qs)}`)
  }
  const chLeaves = leavesOf(ch)
  const quickSelect = (kind: 'weak' | 'new') => {
    setSel(new Set(chLeaves.filter(l => (byLeaf.get(l)?.length ?? 0) > 0 && (kind === 'new' ? !stats[l]?.attempts : levelOf(stats[l]).key === 'weak'))))
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">{name ? `${name}，` : ''}今天練什麼？</h1>
        <p className="mt-1 text-sm text-ink-soft">勾選要練的題型，系統依你的掌握度抽題：弱的、錯過的、還沒練的會多出一些。</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="今天作答" value={today.n} sub={today.n ? `答對 ${fmtPct(today.right / today.n)}` : '還沒開始'} />
        <Tile label="題庫完成度" value={`${all.done}/${all.total}`} sub={`做過 ${fmtPct(all.done / (all.total || 1))} 的題目`} />
        <Tile label="累積正確率" value={all.attempts ? fmtPct(all.correct / all.attempts) : '—'} sub={`共作答 ${all.attempts} 次`} />
        <Link href="/wrong-book" className="block"><Tile label="待複習錯題" value={<span className={due ? 'text-red-600' : ''}>{due}</span>} sub={due ? '點這裡開始複習 →' : '目前沒有到期的錯題'} /></Link>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {bank.chapters.map(c => {
          const p = prog(leavesOf(c))
          return (
            <button key={c.id} onClick={() => pickChapter(c.id)}
              className={`shrink-0 rounded-xl border px-4 py-2 text-left text-sm ${c.id === ch.id ? 'border-brand-500 bg-brand-50' : 'border-black/10 bg-white hover:bg-black/5'}`}>
              <div className="font-semibold">{chapterLabel(c)}</div>
              <div className="text-xs text-ink-muted">做過 {p.done}/{p.total} 題 · 練過 {p.practicedLeaves}/{p.leaves} 個題型</div>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink-soft">快速選擇：</span>
        <button className="chip border border-black/10 bg-white py-1 hover:border-brand-500" onClick={() => quickSelect('weak')}>! 待加強的題型</button>
        <button className="chip border border-black/10 bg-white py-1 hover:border-brand-500" onClick={() => quickSelect('new')}>○ 還沒練的題型</button>
        <button className="chip border border-black/10 bg-white py-1 hover:border-brand-500" onClick={() => setSel(new Set(chLeaves))}>整章</button>
        {sel.size > 0 && <button className="chip py-1 text-ink-muted underline" onClick={() => setSel(new Set())}>清除</button>}
      </div>

      <ChapterTree ch={ch} open={open} toggleOpen={toggleOpen} sel={sel} toggleLeaves={toggleLeaves} prog={prog} stats={stats}
        count={(l: string) => byLeaf.get(l)?.length ?? 0} start={start} />

      {sel.size > 0 && (
        <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
            <div className="text-sm">已選 <b>{sel.size}</b> 個題型（題庫 {selQuestions} 題）</div>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-ink-soft">出</span>
              {COUNTS.map(n => (
                <button key={n} onClick={() => { setCount(n); setPrefs({ count: n }) }}
                  className={`rounded-lg px-2.5 py-1 ${count === n ? 'bg-brand-500 text-white' : 'bg-black/5 hover:bg-black/10'}`}>{n}</button>
              ))}
              <span className="text-ink-soft">題</span>
            </div>
            <button className="btn-primary ml-auto px-6" onClick={() => start([...sel], count, `${chapterLabel(ch)}・${sel.size} 個題型`)}>開始練習 →</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ProgressLine({ p, compact = false }: { p: Progress; compact?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${compact ? 'w-full sm:w-64' : 'w-full sm:w-72'}`}>
      <MasteryBar stat={p.stat} className="flex-1" />
      <span className="w-20 shrink-0 text-right text-xs tabular-nums text-ink-muted">{p.done}/{p.total} 題</span>
      <LevelBadge stat={p.stat} />
    </div>
  )
}

function ChapterTree({ ch, open, toggleOpen, sel, toggleLeaves, prog, stats, count, start }: {
  ch: BankChapter; open: Set<string>; toggleOpen: (k: string) => void; sel: Set<string>; toggleLeaves: (l: string[]) => void
  prog: (l: string[]) => Progress; stats: Record<string, KPStat>; count: (l: string) => number
  start: (leaves: string[], n: number, title: string) => void
}) {
  return (
    <div className="space-y-3">
      {ch.sections.map(s => {
        const sKey = `${ch.id}|${s.id}`
        const sLeaves = leavesOf(ch, { section: s.id })
        const isOpen = open.has(sKey)
        return (
          <div key={s.id} className="card overflow-hidden">
            <button className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-black/[.02]" onClick={() => toggleOpen(sKey)} aria-expanded={isOpen}>
              <span className="text-ink-muted">{isOpen ? '▾' : '▸'}</span>
              <span className="flex-1 font-semibold">{s.id} {s.title}</span>
              <ProgressLine p={prog(sLeaves)} />
            </button>
            {isOpen && (
              <div className="space-y-4 border-t border-black/5 px-4 py-3">
                {s.kps.map(kp => {
                  const kpLeaves = leavesOf(ch, { section: s.id, kp: kp.id })
                  return (
                    <div key={kp.id}>
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Check on={kpLeaves.every(l => sel.has(l))} partial={kpLeaves.some(l => sel.has(l))} onClick={() => toggleLeaves(kpLeaves)} />
                        <span className="flex-1 text-sm font-semibold text-brand-700">知識點 {kp.id}：{kp.title}</span>
                        <ProgressLine p={prog(kpLeaves)} compact />
                      </div>
                      <div className="ml-3 space-y-2 border-l border-black/5 pl-3">
                        {kp.subs.map(sub => {
                          const subLeaves = sub.types.map(t => leafKey(ch.id, sub.id, t.id))
                          const flat = sub.types.length === 1 && sub.types[0].id === 'T0'
                          return (
                            <div key={sub.id}>
                              <div className="flex flex-wrap items-center gap-2 py-1">
                                <Check on={subLeaves.every(l => sel.has(l))} partial={subLeaves.some(l => sel.has(l))} onClick={() => toggleLeaves(subLeaves)} />
                                <span className="flex-1 text-sm font-medium">{sub.id}：{sub.title}</span>
                                {flat
                                  ? <LeafActions leaf={subLeaves[0]} stats={stats} count={count} start={start} title={`${sub.id} ${sub.title}`} prog={prog} />
                                  : <ProgressLine p={prog(subLeaves)} compact />}
                              </div>
                              {!flat && (
                                <div className="ml-6 divide-y divide-black/5">
                                  {sub.types.map(t => {
                                    const leaf = leafKey(ch.id, sub.id, t.id)
                                    return (
                                      <div key={t.id} className="flex flex-wrap items-center gap-2 py-1.5">
                                        <Check on={sel.has(leaf)} onClick={() => toggleLeaves([leaf])} />
                                        <span className="flex-1 text-sm text-ink-soft">{typeLabel(t.id, t.title)}</span>
                                        <LeafActions leaf={leaf} stats={stats} count={count} start={start} title={`${sub.id} ${typeLabel(t.id, t.title)}`} prog={prog} />
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function LeafActions({ leaf, stats, count, start, title, prog }: {
  leaf: string; stats: Record<string, KPStat>; count: (l: string) => number
  start: (leaves: string[], n: number, title: string) => void; title: string; prog: (l: string[]) => Progress
}) {
  const p = prog([leaf])
  const s = stats[leaf]
  return (
    <div className="flex w-full items-center gap-2 sm:w-auto">
      <span className="w-14 text-right text-xs tabular-nums text-ink-muted">{s?.attempts ? fmtPct(s.correct / s.attempts) : ''}</span>
      <ProgressLine p={{ ...p, stat: s }} compact />
      <button className="shrink-0 rounded-lg bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100" disabled={!count(leaf)}
        onClick={() => start([leaf], 5, title)} title="馬上練這個題型 5 題">練 ▶</button>
    </div>
  )
}

function Check({ on, partial = false, onClick }: { on: boolean; partial?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} role="checkbox" aria-checked={on ? true : partial ? 'mixed' : false}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${on ? 'border-brand-500 bg-brand-500 text-white' : partial ? 'border-brand-500 bg-brand-100 text-brand-700' : 'border-black/20 bg-white'}`}>
      {on ? '✓' : partial ? '–' : ''}
    </button>
  )
}
