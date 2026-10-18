'use client'

// 錯題本（版型同 student-app v2 錯題本：篩選列、左範圍、中題目矩陣、右題目詳情）

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import AskAI from '@/components/AskAI'
import { answerLabel } from '@/components/QuestionPanel'
import QImages from '@/components/QImages'
import { Corners, Empty, Sect, fmtDay } from '@/components/ui'
import { chapterLabel, leafOf, leafPath } from '@/lib/bank'
import { startSession } from '@/lib/session'
import { getWrongBook, removeWrong, saveWrong } from '@/lib/storage'
import { ERROR_REASONS, type Bank, type BankQuestion, type Response, type WrongItem } from '@/lib/types'
import { useBank } from '@/lib/use-bank'
import { INTERVAL_DAYS, MASTER_BOX, isDue, markMastered, reviewOrder } from '@/lib/wrongbook'

type Tab = 'due' | 'open' | 'mastered'
const TABS: [Tab, string][] = [['due', '今天要複習'], ['open', '全部未克服'], ['mastered', '已克服']]

const fmtResponse = (r: Response) => r === 'skip' ? '不會' : r === 'self' ? '自評答錯' : typeof r === 'boolean' ? (r ? '○' : '╳') : r.map(n => `(${n})`).join('')

export default function WrongBookPage() {
  const router = useRouter()
  const { bank } = useBank()
  const [items, setItems] = useState<WrongItem[]>([])
  const [tab, setTab] = useState<Tab>('due')
  const [chapter, setChapter] = useState('')
  const [reason, setReason] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const reload = () => setItems(Object.values(getWrongBook()))
  useEffect(reload, [])

  const byId = useMemo(() => new Map((bank?.questions ?? []).map(q => [q.id, q])), [bank])
  if (!bank) return <div style={{ padding: 24 }}><span className="v2-label">LOADING</span></div>

  const now = Date.now()
  const valid = items.filter(w => byId.has(w.qid))
  const counts = { due: valid.filter(w => isDue(w, now)).length, open: valid.filter(w => !w.mastered).length, mastered: valid.filter(w => w.mastered).length }
  const inTab = valid.filter(w => tab === 'due' ? isDue(w, now) : tab === 'open' ? !w.mastered : w.mastered)
  const shown = inTab
    .filter(w => !chapter || byId.get(w.qid)!.chapter === chapter)
    .filter(w => !reason || (reason === '未標記' ? !w.reason : w.reason === reason))
    .sort(tab === 'mastered' ? (a, b) => b.lastWrongAt - a.lastWrongAt : reviewOrder)
  const opened = shown.find(w => w.qid === openId) ?? null

  const startReview = (list: WrongItem[], title: string) => {
    const qs = list.map(w => byId.get(w.qid)!).slice(0, 30)
    if (qs.length) router.push(`/practice?id=${startSession('review', title, qs)}`)
  }
  const update = (w: WrongItem) => { saveWrong(w); reload() }
  const open = (qid: string) => {
    setOpenId(qid)
    // 手機版詳情在清單下方，捲過去
    if (window.innerWidth < 900) setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }
  const status = (w: WrongItem) => w.mastered ? '✓ 已克服' : isDue(w, now) ? '今天複習' : `${fmtDay(w.due)} 複習`
  const boxes = (w: WrongItem) => w.mastered ? '' : '●'.repeat(w.box) + '○'.repeat(MASTER_BOX - w.box)

  // 範圍：本分頁各章節、各錯因的題數
  const byChapter = bank.chapters.map(c => [c, inTab.filter(w => byId.get(w.qid)!.chapter === c.id).length] as const)

  return (
    <div className="v2-enter">
      {/* 篩選列 */}
      <div className="v2-filterbar">
        <span className="grp">狀態</span>
        {TABS.map(([t, label]) => <button key={t} className={`v2-tag${tab === t ? ' is-on' : ''}`} onClick={() => setTab(t)}>{label} {counts[t]}</button>)}
        <span className="grp" style={{ marginLeft: 8 }}>錯因</span>
        <select value={reason} onChange={e => setReason(e.target.value)} className="v2-input">
          <option value="">全部</option>
          {[...ERROR_REASONS, '未標記'].map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={chapter} onChange={e => setChapter(e.target.value)} className="v2-input mob-only">
          <option value="">全部章節</option>
          {bank.chapters.map(c => <option key={c.id} value={c.id}>{chapterLabel(c)}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {shown.length > 0 && (tab === 'due'
            ? <button className="v2-btn v2-btn-primary v2-btn-sm" onClick={() => startReview(shown, `錯題複習（${shown.length} 題）`)}>開始複習 {Math.min(shown.length, 30)} 題 →</button>
            : <button className="v2-btn v2-btn-sm" onClick={() => startReview(shown, `錯題重做（${shown.length} 題）`)}>重做這 {Math.min(shown.length, 30)} 題</button>)}
        </span>
      </div>

      <div className="v2-3col">
        {/* 左：範圍（桌機）*/}
        <div className="desk-only">
          <div className="v2-sect"><div className="v2-label">SCOPE 範圍</div></div>
          <button className="v2-tree-row" style={chapter === '' ? { background: 'var(--color-accent-100)' } : undefined} onClick={() => setChapter('')}>
            <span style={{ flex: 1, fontSize: 13 }}>全部章節</span><span className="v2-mono v2-muted">{inTab.length}</span>
          </button>
          {byChapter.map(([c, n]) => (
            <button key={c.id} className="v2-tree-row" style={chapter === c.id ? { background: 'var(--color-accent-100)' } : undefined} onClick={() => setChapter(c.id)}>
              <span className="truncate" style={{ flex: 1, minWidth: 0, fontSize: 13 }}>{chapterLabel(c)}</span><span className="v2-mono v2-muted">{n}</span>
            </button>
          ))}
          <div style={{ borderBottom: '1px solid var(--color-divider)' }} />
          <p className="v2-muted" style={{ padding: '12px 22px', fontSize: 11, lineHeight: 1.6 }}>
            答錯自動收錄，隔天開始複習；到期答對就拉長間隔（{INTERVAL_DAYS.join('、')} 天），連續答對 {MASTER_BOX} 次算克服。
          </p>
        </div>

        {/* 中：題目清單 */}
        <div>
          <Sect label="WRONG BOOK" title={`錯題本 · ${shown.length} 題`} />
          {shown.length === 0 ? (
            <Empty>{tab === 'due' ? (counts.open ? '今天沒有到期的錯題。想多練可以看「全部未克服」。' : '還沒有錯題，去練習吧！') : '沒有符合條件的題目。'}</Empty>
          ) : (
            <>
              <table className="v2-matrix desk-only">
                <thead><tr><th style={{ paddingLeft: 22 }}>題型</th><th>錯</th><th>錯因</th><th style={{ paddingRight: 22 }}>複習</th></tr></thead>
                <tbody>
                  {shown.map(w => {
                    const q = byId.get(w.qid)!
                    const p = leafPath(bank, leafOf(q))
                    return (
                      <tr key={w.qid} onClick={() => open(w.qid)} className={openId === w.qid ? 'is-top' : undefined} style={{ cursor: 'pointer' }}>
                        <td style={{ paddingLeft: 22 }}><div className="truncate" style={{ fontSize: 13, maxWidth: 300 }}>{p.type}</div><div className="v2-muted" style={{ fontSize: 11 }}>{p.sub?.split(' ')[0]} · 第 {q.no} 題</div></td>
                        <td className="num">{w.wrongCount}</td>
                        <td className="v2-muted" style={{ fontSize: 12 }}>{w.reason ?? '—'}</td>
                        <td style={{ paddingRight: 22 }}>
                          <div className="v2-mono" style={{ color: isDue(w, now) ? 'var(--color-accent-900)' : 'var(--color-accent-700)', fontWeight: isDue(w, now) ? 600 : 400 }}>{status(w)}</div>
                          <div className="v2-mono v2-muted" style={{ fontSize: 10 }}>{boxes(w)}</div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="mob-only flex flex-col">
                {shown.map(w => {
                  const q = byId.get(w.qid)!
                  const p = leafPath(bank, leafOf(q))
                  return (
                    <button key={w.qid} onClick={() => open(w.qid)} className="v2-tree-row" style={openId === w.qid ? { background: 'var(--color-accent-100)' } : undefined}>
                      <span className="min-w-0" style={{ flex: 1 }}>
                        <span className="truncate" style={{ display: 'block', fontSize: 13 }}>{p.type}</span>
                        <span className="v2-muted" style={{ fontSize: 11 }}>{p.sub?.split(' ')[0]} · 第 {q.no} 題 · 錯 {w.wrongCount} 次{w.reason ? ` · ${w.reason}` : ''}</span>
                      </span>
                      <span className="v2-mono" style={{ color: isDue(w, now) ? 'var(--color-accent-900)' : 'var(--color-accent-700)' }}>{status(w)}</span>
                    </button>
                  )
                })}
                <div style={{ borderBottom: '1px solid var(--color-divider)' }} />
              </div>
            </>
          )}
        </div>

        {/* 右：題目詳情 */}
        <div ref={detailRef}>
          {opened ? <Detail w={opened} q={byId.get(opened.qid)!} bank={bank} status={status(opened)} onUpdate={update}
            onRemove={() => { if (confirm('從錯題本移除這題？')) { removeWrong(opened.qid); setOpenId(null); reload() } }} />
            : <><Sect label="DETAIL" title="題目詳情" /><Empty>點選左邊的題目，看題目、你的答案、答案與詳解。</Empty></>}
        </div>
      </div>
    </div>
  )
}

function Detail({ w, q, bank, status, onUpdate, onRemove }: {
  w: WrongItem; q: BankQuestion; bank: Bank; status: string; onUpdate: (w: WrongItem) => void; onRemove: () => void
}) {
  const [note, setNote] = useState(w.note ?? '')
  useEffect(() => setNote(w.note ?? ''), [w.qid, w.note])
  const ans = answerLabel(q)
  const p = leafPath(bank, leafOf(q))
  return (
    <div>
      <Sect label="DETAIL" title={p.type ?? ''} sub={`${p.chapter ? chapterLabel(p.chapter) : ''} › ${p.section} › ${p.sub} · 第 ${q.no} 題`} />
      <div className="flex flex-col" style={{ gap: 12, padding: '0 22px 22px' }}>
        <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
          <span className="v2-chip">錯 {w.wrongCount} 次</span>
          <span className="v2-mono">{status}</span>
          <span className="v2-mono v2-muted" style={{ marginLeft: 'auto' }}>首錯 {fmtDay(w.firstWrongAt)} · 最近 {fmtDay(w.lastWrongAt)}</span>
        </div>
        <div className="blueprint v2-paper"><QImages srcs={q.img.q} alt="題目" /><Corners /></div>
        <div style={{ fontSize: 13 }}>
          你上次的答案 <b style={{ color: 'var(--color-accent-900)' }}>{fmtResponse(w.response)}</b>
          {ans && <> · 正解 <b>{ans}</b></>}
        </div>
        {q.img.a?.length ? <div><div className="v2-label" style={{ marginBottom: 6 }}>ANSWER 答案</div><div className="v2-paper" style={{ border: '1px solid var(--color-divider)' }}><QImages srcs={q.img.a} alt="答案" /></div></div> : null}
        <div>
          <div className="v2-label" style={{ marginBottom: 6 }}>SOLUTION 詳解</div>
          <div className="v2-paper" style={{ border: '1px solid var(--color-divider)' }}>
            {q.img.s?.length ? <QImages srcs={q.img.s} alt="詳解" /> : <span className="v2-muted" style={{ fontSize: 13 }}>原文件沒有附詳解</span>}
          </div>
        </div>
        <div className="flex flex-col" style={{ gap: 8 }}>
          <div className="v2-label">ERROR CAUSE 錯因與筆記</div>
          <div className="flex flex-wrap" style={{ gap: 6 }}>
            {ERROR_REASONS.map(r => (
              <button key={r} onClick={() => onUpdate({ ...w, reason: w.reason === r ? undefined : r })} className={`v2-tag${w.reason === r ? ' is-on' : ''}`}>{r}</button>
            ))}
          </div>
          <textarea value={note} onChange={e => setNote(e.target.value)} onBlur={() => note.trim() !== (w.note ?? '') && onUpdate({ ...w, note: note.trim() })}
            maxLength={300} rows={2} placeholder="筆記：這題要注意什麼？" className="v2-input" />
        </div>
        <AskAI qid={q.id} />
        <div className="flex" style={{ gap: 8 }}>
          <button className="v2-btn v2-btn-primary" style={{ flex: 1 }} onClick={() => onUpdate(markMastered(w, !w.mastered))}>{w.mastered ? '移回待複習' : '✓ 我已經會了'}</button>
          <button className="v2-btn" onClick={onRemove}>移除</button>
        </div>
      </div>
    </div>
  )
}
