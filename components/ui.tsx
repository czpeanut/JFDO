// 共用元件（版型同 student-app v2：統計格、三段式掌握度條、等寬微標籤）

import { levelOf } from '@/lib/mastery'
import type { Progress } from '@/lib/bank'
import type { KPStat } from '@/lib/types'

/** 統計格（放在 .v2-stats 裡）：大數字＋中英標籤 */
export function Stat({ num, unit, cap, sub }: { num: React.ReactNode; unit?: string; cap: string; sub?: React.ReactNode }) {
  return (
    <div className="v2-stat">
      <div className="num">{num}{unit && <span>{unit}</span>}</div>
      <div className="cap">{cap}</div>
      {sub != null && <div className="v2-muted" style={{ fontSize: 11, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

/** 區段標題：KICKER ＋ 標題 */
export function Sect({ label, title, sub, right }: { label: string; title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="v2-sect flex items-end" style={{ gap: 12 }}>
      <div className="min-w-0 flex-1">
        <div className="v2-label" style={{ marginBottom: 4 }}>{label}</div>
        <h2>{title}</h2>
        {sub != null && <p className="v2-muted" style={{ fontSize: 12, marginTop: 4 }}>{sub}</p>}
      </div>
      {right}
    </div>
  )
}

const LEVEL_COLOR = { none: 'rgba(29,31,32,.45)', weak: 'var(--color-accent-900)', mid: 'var(--color-accent-700)', good: 'var(--color-accent-600)' }
const LEVEL_ICON = { none: '○', weak: '▲', mid: '◐', good: '✓' }

/** 掌握度等級（文字一定搭配圖示，不只靠顏色） */
export function LevelText({ stat, showScore = true }: { stat: KPStat | undefined; showScore?: boolean }) {
  const lv = levelOf(stat)
  return (
    <span className="v2-mono whitespace-nowrap" style={{ color: LEVEL_COLOR[lv.key], fontWeight: lv.key === 'weak' ? 600 : 400 }}>
      {LEVEL_ICON[lv.key]} {lv.label}{showScore && stat && stat.attempts > 0 ? ` ${Math.round(stat.score)}` : ''}
    </span>
  )
}

const SEG = { weak: 'seg-unknown', mid: 'seg-review', good: 'seg-mastered' }

/** 單一題型的掌握度條：依分數填滿，顏色依等級 */
export function ScoreBar({ stat, height = 7 }: { stat: KPStat | undefined; height?: number }) {
  const lv = levelOf(stat)
  const pct = stat && stat.attempts > 0 ? Math.max(2, stat.score) : 0
  return (
    <div className="v2-bar" style={{ height }} role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="掌握度">
      {pct > 0 && lv.key !== 'none' && <div className={SEG[lv.key]} style={{ flexGrow: pct }} />}
      <div className="seg-empty" style={{ flexGrow: 100 - pct }} />
    </div>
  )
}

/** 一組題型的三段式掌握度條（待加強／進步中／已掌握／未練習的題型數） */
export function DistBar({ p, height = 7 }: { p: Progress; height?: number }) {
  const { weak, mid, good, none } = p.dist
  return (
    <div className="v2-bar" style={{ height }} title={`待加強 ${weak}・進步中 ${mid}・已掌握 ${good}・未練習 ${none}（題型數）`}>
      {weak > 0 && <div className="seg-unknown" style={{ flexGrow: weak }} />}
      {mid > 0 && <div className="seg-review" style={{ flexGrow: mid }} />}
      {good > 0 && <div className="seg-mastered" style={{ flexGrow: good }} />}
      {(none > 0 || weak + mid + good === 0) && <div className="seg-empty" style={{ flexGrow: none || 1 }} />}
    </div>
  )
}

export function Corners() {
  return <><i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" /></>
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="v2-muted" style={{ padding: '18px 22px', fontSize: 13 }}>{children}</p>
}

export const fmtPct = (v: number) => `${Math.round(v * 100)}%`
export const pad2 = (n: number) => String(n).padStart(2, '0')
export const fmtDate = (t: number) => {
  const d = new Date(t)
  return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}
export const fmtDay = (t: number) => { const d = new Date(t); return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}` }
