import { levelOf } from '@/lib/mastery'
import type { KPStat } from '@/lib/types'

export function Tile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {sub != null && <div className="mt-0.5 text-xs text-ink-muted">{sub}</div>}
    </div>
  )
}

const TONE_CLASS = { muted: 'bg-black/5 text-ink-muted', good: 'bg-green-50 text-green-800', mid: 'bg-amber-50 text-amber-800', bad: 'bg-red-50 text-red-700' }
const TONE_ICON = { muted: '○', good: '✓', mid: '↗', bad: '!' }
const BAR_CLASS = { muted: 'bg-black/10', good: 'bg-green-600', mid: 'bg-amber-500', bad: 'bg-red-500' }

/** 掌握度徽章：顏色一定搭配圖示與文字，不只靠顏色辨識 */
export function LevelBadge({ stat, showScore = true }: { stat: KPStat | undefined; showScore?: boolean }) {
  const lv = levelOf(stat)
  return (
    <span className={`chip whitespace-nowrap ${TONE_CLASS[lv.tone]}`}>
      {TONE_ICON[lv.tone]} {lv.label}{showScore && stat && stat.attempts > 0 && <span className="ml-1 tabular-nums opacity-80">{Math.round(stat.score)}</span>}
    </span>
  )
}

/** 掌握度條：0–100，顏色依等級 */
export function MasteryBar({ stat, className = '' }: { stat: KPStat | undefined; className?: string }) {
  const lv = levelOf(stat)
  const pct = stat && stat.attempts > 0 ? stat.score : 0
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-black/5 ${className}`} role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="掌握度">
      <div className={`h-full rounded-full transition-all ${BAR_CLASS[lv.tone]}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function ProgressBar({ value, max = 1, className = '' }: { value: number; max?: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100))
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-black/5 ${className}`}>
      <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-black/10 p-6 text-center text-sm text-ink-muted">{children}</div>
}

export const fmtPct = (v: number) => `${Math.round(v * 100)}%`
export const fmtDate = (t: number) => {
  const d = new Date(t)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
export const fmtDay = (t: number) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}` }
