// 出題分配（純函式）：這一組要從選的知識點各抽幾題。
// 弱的、剛錯的、沒練過的多出一些；已掌握的少出（但不為零，維持複習）。
// 題數用 D'Hondt 法依權重分配，單一知識點有上限，也不超過題庫題數。

import { levelForScore } from './mastery'
import type { DrawTarget, KPStat } from './types'

export type PlanInput = { key: string; unit: string; type?: string; available: number; stat?: KPStat }

export function weightOf(stat: KPStat | undefined): number {
  if (!stat || stat.attempts === 0) return 100 + 25
  const recentWrong = stat.recent.slice(-5).filter(c => !c).length
  return Math.max(10, 100 - stat.score) + 15 * recentWrong
}

export function allocate(n: number, kps: PlanInput[]): Map<string, number> {
  const out = new Map<string, number>(kps.map(k => [k.key, 0]))
  const usable = kps.filter(k => k.available > 0)
  if (!usable.length || n <= 0) return out
  const cap = Math.max(3, Math.ceil(n / usable.length) + 1)
  const w = new Map(usable.map(k => [k.key, weightOf(k.stat)]))
  for (let i = 0; i < n; i++) {
    let best: PlanInput | null = null
    let bestQ = -1
    for (const k of usable) {
      const c = out.get(k.key)!
      if (c >= Math.min(cap, k.available)) continue
      const q = w.get(k.key)! / (c + 1)
      if (q > bestQ) { bestQ = q; best = k }
    }
    if (!best) break
    out.set(best.key, out.get(best.key)! + 1)
  }
  return out
}

/** 分配結果 → 給 /api/draw 的抽題目標（數學附上建議難度） */
export function toTargets(kps: PlanInput[], counts: Map<string, number>, withLevel: boolean): DrawTarget[] {
  return kps.filter(k => (counts.get(k.key) ?? 0) > 0).map(k => ({
    unit: k.unit, ...(k.type ? { type: k.type } : {}), n: counts.get(k.key)!,
    ...(withLevel ? { level: levelForScore(k.stat?.score ?? 50) } : {}),
  }))
}

/** 同一知識點的題目不要連在一起（交錯練習） */
export function interleave<T>(items: T[], groupOf: (t: T) => string): T[] {
  const groups = new Map<string, T[]>()
  for (const t of items) { const g = groupOf(t); if (!groups.has(g)) groups.set(g, []); groups.get(g)!.push(t) }
  const queues = [...groups.values()].sort((a, b) => b.length - a.length)
  const out: T[] = []
  while (queues.some(q => q.length)) for (const q of queues) if (q.length) out.push(q.shift()!)
  return out
}
