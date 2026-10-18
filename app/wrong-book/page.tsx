'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import AskAI from '@/components/AskAI'
import { answerLabel } from '@/components/QuestionPanel'
import QImages from '@/components/QImages'
import { Empty, fmtDay } from '@/components/ui'
import { chapterLabel, leafOf, leafPath } from '@/lib/bank'
import { startSession } from '@/lib/session'
import { getWrongBook, removeWrong, saveWrong } from '@/lib/storage'
import { ERROR_REASONS, type BankQuestion, type Response, type WrongItem } from '@/lib/types'
import { useBank } from '@/lib/use-bank'
import { INTERVAL_DAYS, MASTER_BOX, isDue, markMastered, reviewOrder } from '@/lib/wrongbook'

type Tab = 'due' | 'open' | 'mastered'

const fmtResponse = (r: Response) => r === 'skip' ? '不會' : r === 'self' ? '自評答錯' : typeof r === 'boolean' ? (r ? '○' : '╳') : r.map(n => `(${n})`).join('')

export default function WrongBookPage() {
  const router = useRouter()
  const { bank } = useBank()
  const [items, setItems] = useState<WrongItem[]>([])
  const [tab, setTab] = useState<Tab>('due')
  const [chapter, setChapter] = useState('')
  const [reason, setReason] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const reload = () => setItems(Object.values(getWrongBook()))
  useEffect(reload, [])

  const byId = useMemo(() => new Map((bank?.questions ?? []).map(q => [q.id, q])), [bank])
  if (!bank) return <div className="p-6 text-ink-muted">載入中…</div>

  const now = Date.now()
  const valid = items.filter(w => byId.has(w.qid))
  const counts = { due: valid.filter(w => isDue(w, now)).length, open: valid.filter(w => !w.mastered).length, mastered: valid.filter(w => w.mastered).length }
  const shown = valid
    .filter(w => tab === 'due' ? isDue(w, now) : tab === 'open' ? !w.mastered : w.mastered)
    .filter(w => !chapter || byId.get(w.qid)!.chapter === chapter)
    .filter(w => !reason || (reason === '未標記' ? !w.reason : w.reason === reason))
    .sort(tab === 'mastered' ? (a, b) => b.lastWrongAt - a.lastWrongAt : reviewOrder)

  const startReview = (list: WrongItem[], title: string) => {
    const qs = list.map(w => byId.get(w.qid)!).slice(0, 30)
    if (qs.length) router.push(`/practice?id=${startSession('review', title, qs)}`)
  }
  const update = (w: WrongItem) => { saveWrong(w); reload() }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">錯題本</h1>
        <p className="mt-1 text-sm text-ink-soft">答錯的題目會自動收進來，隔天開始複習；到期時答對就拉長間隔（{INTERVAL_DAYS.join('、')} 天），連續答對 {MASTER_BOX} 次就算克服。</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {([['due', '今天要複習'], ['open', '全部未克服'], ['mastered', '已克服']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-xl px-4 py-2 text-sm ${tab === t ? 'bg-brand-500 text-white' : 'bg-white text-ink-soft ring-1 ring-black/10 hover:bg-black/5'}`}>
            {label} <span className="tabular-nums opacity-80">{counts[t]}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select value={chapter} onChange={e => setChapter(e.target.value)} className="rounded-lg border border-black/10 bg-white px-2 py-1.5">
          <option value="">全部章節</option>
          {bank.chapters.map(c => <option key={c.id} value={c.id}>{chapterLabel(c)}</option>)}
        </select>
        <select value={reason} onChange={e => setReason(e.target.value)} className="rounded-lg border border-black/10 bg-white px-2 py-1.5">
          <option value="">全部錯因</option>
          {[...ERROR_REASONS, '未標記'].map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <div className="ml-auto flex flex-wrap gap-2">
          {tab === 'due' && shown.length > 0 && <button className="btn-primary" onClick={() => startReview(shown, `錯題複習（${shown.length} 題）`)}>開始複習 {Math.min(shown.length, 30)} 題 →</button>}
          {tab !== 'due' && shown.length > 0 && <button className="btn-outline" onClick={() => startReview(shown, `錯題重做（${shown.length} 題）`)}>重做這 {Math.min(shown.length, 30)} 題</button>}
        </div>
      </div>

      {shown.length === 0 ? (
        <Empty>{tab === 'due' ? (counts.open ? '今天沒有到期的錯題 🎉 想多練可以看「全部未克服」' : '還沒有錯題，去練習吧！') : '這裡沒有題目'}</Empty>
      ) : (
        <div className="space-y-3">
          {shown.map(w => <WrongCard key={w.qid} w={w} q={byId.get(w.qid)!} open={openId === w.qid} now={now}
            path={leafPath(bank, leafOf(byId.get(w.qid)!))}
            onToggle={() => setOpenId(openId === w.qid ? null : w.qid)} onUpdate={update}
            onRemove={() => { if (confirm('從錯題本移除這題？')) { removeWrong(w.qid); reload() } }} />)}
        </div>
      )}
    </div>
  )
}

function WrongCard({ w, q, path, open, now, onToggle, onUpdate, onRemove }: {
  w: WrongItem; q: BankQuestion; path: ReturnType<typeof leafPath>; open: boolean; now: number
  onToggle: () => void; onUpdate: (w: WrongItem) => void; onRemove: () => void
}) {
  const [note, setNote] = useState(w.note ?? '')
  const ans = answerLabel(q)
  return (
    <div className="card overflow-hidden">
      <button className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-black/[.02] sm:flex-row sm:items-center sm:gap-3" onClick={onToggle} aria-expanded={open}>
        <div className="min-w-0 sm:flex-1">
          <div className="truncate text-sm font-medium">{path.type ?? path.sub}</div>
          <div className="truncate text-xs text-ink-muted">{path.chapter ? chapterLabel(path.chapter) : ''} › {path.section} › {path.sub} · 第 {q.no} 題</div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {w.reason && <span className="chip bg-amber-50 text-amber-800">{w.reason}</span>}
          <span className="text-xs tabular-nums text-red-600">錯 {w.wrongCount} 次</span>
          <span className="text-xs text-ink-muted">
            {w.mastered ? '✓ 已克服' : isDue(w, now) ? <b className="text-red-600">今天複習</b> : `${fmtDay(w.due)} 複習`}
            {!w.mastered && <span className="ml-1" title={`複習進度 ${w.box}/${MASTER_BOX}`}>{'●'.repeat(w.box)}{'○'.repeat(MASTER_BOX - w.box)}</span>}
          </span>
        </div>
      </button>
      {!open && <div className="px-4 pb-3"><div className="max-h-28 overflow-hidden opacity-90 [mask-image:linear-gradient(to_bottom,black_60%,transparent)]"><QImages srcs={q.img.q.slice(0, 1)} alt="題目" /></div></div>}
      {open && (
        <div className="space-y-3 border-t border-black/5 p-4">
          <QImages srcs={q.img.q} alt="題目" />
          <div className="text-sm text-ink-soft">
            你上次的答案：<b className="text-red-600">{fmtResponse(w.response)}</b>
            {ans && <> · 正確答案：<b className="text-ink">{ans}</b></>}
            <span className="ml-2 text-xs text-ink-muted">第一次錯在 {fmtDay(w.firstWrongAt)}，最近一次 {fmtDay(w.lastWrongAt)}</span>
          </div>
          {q.img.a?.length ? <div className="rounded-lg bg-amber-50/60 p-2"><QImages srcs={q.img.a} alt="答案" /></div> : null}
          <div className="rounded-lg border border-black/5 p-2">
            <div className="mb-1 text-xs font-semibold text-ink-soft">📘 詳解</div>
            {q.img.s?.length ? <QImages srcs={q.img.s} alt="詳解" /> : <div className="text-sm text-ink-muted">原文件沒有附詳解</div>}
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-ink-soft">錯因</div>
            <div className="flex flex-wrap gap-1.5">
              {ERROR_REASONS.map(r => (
                <button key={r} onClick={() => onUpdate({ ...w, reason: w.reason === r ? undefined : r })}
                  className={`chip border py-1 ${w.reason === r ? 'border-brand-500 bg-brand-500 text-white' : 'border-black/10 bg-white text-ink-soft hover:border-brand-500'}`}>{r}</button>
              ))}
            </div>
            <textarea value={note} onChange={e => setNote(e.target.value)} onBlur={() => note.trim() !== (w.note ?? '') && onUpdate({ ...w, note: note.trim() })}
              maxLength={300} rows={2} placeholder="筆記：這題要注意什麼？"
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </div>
          <AskAI qid={q.id} />
          <div className="flex flex-wrap gap-2">
            <button className="btn-outline" onClick={() => onUpdate(markMastered(w, !w.mastered))}>{w.mastered ? '移回待複習' : '✓ 我已經會了'}</button>
            <button className="btn-ghost text-red-600" onClick={onRemove}>移除</button>
          </div>
        </div>
      )}
    </div>
  )
}
