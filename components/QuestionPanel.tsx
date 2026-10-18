'use client'

// 一題的作答流程：
//   選項題 → 點選項（可能多選）→ 送出自動批改
//   是非題 → ○／╳ 自動批改
//   其他（計算、填充、證明）→ 在紙上算好 → 看答案 → 自己判斷「答對了／答錯了」
//   任何題都可以按「不會，看詳解」（算答錯）
// 批改後顯示答案、題庫詳解、問 AI；答錯可以記錄錯因與筆記（進錯題本）。

import { useEffect, useRef, useState } from 'react'
import AskAI from './AskAI'
import QImages from './QImages'
import { grade } from '@/lib/practice'
import { addFlag, getWrongBook, saveWrong } from '@/lib/storage'
import { ERROR_REASONS, type BankQuestion, type Confidence, type ErrorReason, type Response } from '@/lib/types'

export type Result = { response: Response; correct: boolean; ms: number; confidence?: Confidence }

/** 作答過快提醒門檻（快速猜題的下限，見 lib/learning-profile.ts） */
const FAST_MS = 3000
/** 冷靜作答：題目出現後幾秒才能送出（Meichenbaum & Goodman：重點是檢查步驟，等待只是讓學生有空檢查） */
const CALM_SECONDS = 5
const CONF: { c: Confidence; label: string; cls: string }[] = [
  { c: 'sure', label: '✓ 有把握', cls: 'btn-primary' },
  { c: 'unsure', label: '？不太確定', cls: 'btn-outline' },
  { c: 'guess', label: '🎲 用猜的', cls: 'btn-outline' },
]

const fmtResponse = (q: BankQuestion, r: Response) =>
  r === 'skip' ? '不會' : r === 'self' ? '自己對答案' : typeof r === 'boolean' ? (r ? '○' : '╳') : r.map(n => `(${n})`).join('')

export function answerLabel(q: BankQuestion): string | null {
  if (q.kind === 'choice' && Array.isArray(q.answer)) return q.answer.map(n => `(${n})`).join('')
  if (q.kind === 'tf' && typeof q.answer === 'boolean') return q.answer ? '○' : '╳'
  return null
}

export default function QuestionPanel({ q, result, onResult, onNext, nextLabel = '下一題', calm = false }: {
  q: BankQuestion
  /** 已作答（從暫停回來、或看結果時） */
  result?: Result
  onResult: (r: Result) => void
  onNext?: () => void
  nextLabel?: string
  /** 冷靜作答（學習習慣偵測到衝動型作答時開啟） */
  calm?: boolean
}) {
  const [picked, setPicked] = useState<number[]>([])
  const [tf, setTf] = useState<boolean | null>(null)
  // 看答案自評：已按「對答案」（記下當時的作答時間與把握度），還沒判斷對錯
  const [revealed, setRevealed] = useState<{ ms: number; confidence: Confidence } | null>(null)
  const [fastWarn, setFastWarn] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const started = useRef(Date.now())

  useEffect(() => { setPicked([]); setTf(null); setRevealed(null); setFastWarn(false); setElapsed(0); started.current = Date.now() }, [q.id])
  useEffect(() => {
    if (!calm || result) return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started.current) / 1000)), 500)
    return () => clearInterval(t)
  }, [calm, result, q.id])

  const done = !!result
  const calmWait = calm && elapsed < CALM_SECONDS
  const finish = (response: Response, confidence: Confidence | undefined, ms: number, correctOverride?: boolean) => {
    if (done) return
    onResult({ response, correct: correctOverride ?? grade(q, response) ?? false, ms, ...(confidence ? { confidence } : {}) })
  }
  /** 依把握度送出（計算題＝對答案）。3 秒內送出先提醒一次（快速猜題門檻） */
  const trySubmit = (confidence: Confidence) => {
    const ms = Date.now() - started.current
    if (calm && ms / 1000 < CALM_SECONDS) return
    if (ms < FAST_MS && !fastWarn) { setFastWarn(true); return }
    if (q.kind === 'choice') finish(picked, confidence, ms)
    else if (q.kind === 'tf' && tf !== null) finish(tf, confidence, ms)
    else if (q.kind === 'open') setRevealed({ ms, confidence })
  }
  const skip = () => finish('skip', 'guess', Date.now() - started.current)
  const toggle = (n: number) => {
    if (done) return
    setPicked(p => q.single ? [n] : p.includes(n) ? p.filter(x => x !== n) : [...p, n].sort((a, b) => a - b))
  }
  const ready = q.kind === 'choice' ? picked.length > 0 : q.kind === 'tf' ? tf !== null : true

  // 鍵盤：數字選選項、Enter 下一題
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return
      if (!done && q.kind === 'choice' && /^[1-9]$/.test(e.key) && Number(e.key) <= (q.options ?? 0)) toggle(Number(e.key))
      else if (e.key === 'Enter' && done) onNext?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="space-y-4">
      <div className="card overflow-x-auto p-4 sm:p-5">
        <QImages srcs={q.img.q} alt="題目" />
      </div>

      {!done && (
        <div className="card space-y-3 p-4">
          {q.kind === 'choice' && (
            <>
              <div className="text-sm text-ink-soft">{q.single ? '選一個答案' : '選出所有正確的選項（可能不只一個）'}</div>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: q.options ?? 0 }, (_, i) => i + 1).map(n => (
                  <button key={n} onClick={() => toggle(n)} aria-pressed={picked.includes(n)}
                    className={`h-12 w-14 rounded-xl border text-lg font-semibold transition ${picked.includes(n) ? 'border-brand-500 bg-brand-500 text-white' : 'border-black/10 bg-white hover:border-brand-500'}`}>
                    ({n})
                  </button>
                ))}
              </div>
            </>
          )}
          {q.kind === 'tf' && (
            <div className="flex flex-wrap gap-2">
              {[true, false].map(v => (
                <button key={String(v)} onClick={() => setTf(v)} aria-pressed={tf === v}
                  className={`h-12 w-20 rounded-xl border text-xl transition ${tf === v ? 'border-brand-500 bg-brand-500 text-white' : 'border-black/10 bg-white hover:border-brand-500'}`}>{v ? '○' : '╳'}</button>
              ))}
            </div>
          )}
          {q.kind === 'open' && !revealed && <div className="text-sm text-ink-soft">這題是計算／填充題：先在紙上算出答案，再依你的把握程度按下面的按鈕對答案。</div>}

          {revealed ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-amber-50/60 p-3">
                {q.img.a?.length ? <QImages srcs={q.img.a} alt="答案" /> : <div className="text-sm text-ink-soft">這題原文件只附詳解，對照下面的詳解。</div>}
                {!q.img.a?.length && <QImages srcs={q.img.s} alt="詳解" className="mt-2" />}
              </div>
              <div className="text-sm font-medium">和你算的一樣嗎？</div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary bg-green-600 hover:bg-green-700" onClick={() => finish('self', revealed.confidence, revealed.ms, true)}>✓ 我答對了</button>
                <button className="btn-primary bg-red-500 hover:bg-red-600" onClick={() => finish('self', revealed.confidence, revealed.ms, false)}>✗ 我答錯了（含部分錯）</button>
              </div>
            </div>
          ) : (
            <>
              {calm && ready && (
                <div className="rounded-xl bg-brand-50 px-3 py-2 text-sm">
                  <div className="font-medium">🧘 冷靜作答：送出前檢查一下{calmWait && `（${CALM_SECONDS - elapsed} 秒）`}</div>
                  <ol className="mt-1 list-inside list-decimal text-ink-soft">
                    <li>題目問什麼？關鍵字（正負號、範圍、「何者錯誤」）圈了嗎？</li>
                    <li>答案大概多少？和你算的差不多嗎？</li>
                    <li>再對照一次題目，確定沒看錯</li>
                  </ol>
                </div>
              )}
              {fastWarn && <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">⏱ 作答很快喔，要不要再看一次題目？確定的話再按一次。</div>}
              <div className="flex flex-wrap gap-2">
                {CONF.map(({ c, label, cls }) => (
                  <button key={c} className={cls} disabled={!ready || calmWait} onClick={() => trySubmit(c)}>
                    {q.kind === 'open' ? `${label}，對答案` : label}
                  </button>
                ))}
                <button className="btn-ghost" onClick={skip}>不會，看詳解</button>
              </div>
              {q.kind !== 'open' && <div className="text-xs text-ink-muted">依你的把握程度送出：用猜的答對不太會加分，有把握卻錯會優先複習</div>}
            </>
          )}
        </div>
      )}

      {done && result && <Review q={q} result={result} onNext={onNext} nextLabel={nextLabel} />}
    </div>
  )
}

function Review({ q, result, onNext, nextLabel }: { q: BankQuestion; result: Result; onNext?: () => void; nextLabel: string }) {
  const ans = answerLabel(q)
  return (
    <div className="space-y-4">
      <div className={`card p-4 ${result.correct ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className={`text-lg font-bold ${result.correct ? 'text-green-700' : 'text-red-600'}`}>{result.correct ? '✓ 答對了' : '✗ 答錯了'}</span>
          {q.kind !== 'open' && <span className="text-sm text-ink-soft">你的答案：{fmtResponse(q, result.response)}</span>}
          {ans && <span className="text-sm text-ink-soft">正確答案：<b className="text-ink">{ans}</b></span>}
          {!result.correct && <span className="text-xs text-ink-muted">已收進錯題本，明天會再出現</span>}
        </div>
        {q.img.a?.length ? <QImages srcs={q.img.a} alt="答案" className="mt-3" /> : null}
      </div>

      {!result.correct && <ErrorNote qid={q.id} />}

      <div className="card space-y-2 p-4">
        <div className="text-sm font-semibold">📘 詳解</div>
        {q.img.s?.length ? <QImages srcs={q.img.s} alt="詳解" /> : <div className="text-sm text-ink-muted">原文件沒有附詳解，可以問 AI。</div>}
      </div>

      <AskAI qid={q.id} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <FlagButton qid={q.id} />
        {onNext && <button className="btn-primary px-6" onClick={onNext}>{nextLabel} →</button>}
      </div>
    </div>
  )
}

/** 錯因與筆記：存在錯題本，之後複習時看得到 */
function ErrorNote({ qid }: { qid: string }) {
  const [reason, setReason] = useState<ErrorReason | undefined>()
  const [note, setNote] = useState('')
  useEffect(() => { const w = getWrongBook()[qid]; setReason(w?.reason); setNote(w?.note ?? '') }, [qid])
  const save = (patch: { reason?: ErrorReason; note?: string }) => {
    const w = getWrongBook()[qid]
    if (w) saveWrong({ ...w, ...patch })
  }
  return (
    <div className="card space-y-2 p-4">
      <div className="text-sm font-semibold">✏️ 錯在哪裡？（記下來，複習時會看到）</div>
      <div className="flex flex-wrap gap-1.5">
        {ERROR_REASONS.map(r => (
          <button key={r} onClick={() => { setReason(r); save({ reason: r }) }}
            className={`chip border py-1 ${reason === r ? 'border-brand-500 bg-brand-500 text-white' : 'border-black/10 bg-white text-ink-soft hover:border-brand-500'}`}>{r}</button>
        ))}
      </div>
      <textarea value={note} onChange={e => setNote(e.target.value)} onBlur={() => save({ note: note.trim() })} maxLength={300} rows={2}
        placeholder="筆記：例如「忘記 (a+b)³ 的展開」「負號沒變號」"
        className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500" />
    </div>
  )
}

function FlagButton({ qid }: { qid: string }) {
  const [sent, setSent] = useState(false)
  useEffect(() => setSent(false), [qid])
  if (sent) return <span className="text-xs text-ink-muted">已記下這題，會轉給題庫作者檢查</span>
  return (
    <button className="text-xs text-ink-muted underline hover:text-red-600" onClick={() => {
      const why = prompt('這題哪裡怪怪的？（例：答案和詳解不一致、圖片切掉了）')
      if (why !== null) { addFlag(qid, why.trim() || '學生回報'); setSent(true) }
    }}>⚠ 回報題目有誤</button>
  )
}
