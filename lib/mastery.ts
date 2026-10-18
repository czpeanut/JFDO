// 掌握度模型（純函式）：沿用 Self-learning-sys lib/engine.ts 的類 Elo 做法。
// 每個知識點 0–100 分；題目依難度有門檻分，答對「意外程度」越高加越多、答錯簡單題扣越多。
// 題庫只有數學有難度，其他科一律視為標準難度。

import type { KPStat } from './types'

export const INITIAL_SCORE = 50
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))

/** 題庫難度（1–5，null＝未評）→ 門檻分 */
export function difficultyRating(d: number | null): number {
  if (d == null) return 55
  return ({ 1: 40, 2: 55, 3: 70, 4: 80, 5: 90 } as Record<number, number>)[d] ?? 55
}

export const expectedCorrect = (score: number, d: number | null) => 1 / (1 + Math.exp(-(score - difficultyRating(d)) / 12))

export const newStat = (): KPStat => ({ score: INITIAL_SCORE, attempts: 0, correct: 0, recent: [], last: 0 })

/** 作答一次後更新；skipped（跳過／不會）照答錯算，但不額外加重 */
export function updateStat(s: KPStat | undefined, correct: boolean, difficulty: number | null, now = Date.now()): KPStat {
  const m = s ?? newStat()
  const p = expectedCorrect(m.score, difficulty)
  const k = m.attempts < 5 ? 24 : 16          // 新知識點收斂快一點
  const delta = correct ? k * (1 - p) : -k * p
  return {
    score: Math.round(clamp(m.score + delta) * 10) / 10,
    attempts: m.attempts + 1,
    correct: m.correct + (correct ? 1 : 0),
    recent: [...m.recent, correct].slice(-10),
    last: now,
  }
}

export type Level = { key: 'none' | 'weak' | 'mid' | 'good'; label: string; tone: 'muted' | 'bad' | 'mid' | 'good' }

/** 等級：<55 待加強、55–79 進步中、≥80 已掌握（至少練 5 題才算已掌握） */
export function levelOf(s: KPStat | undefined): Level {
  if (!s || s.attempts === 0) return { key: 'none', label: '未練習', tone: 'muted' }
  if (s.score < 55) return { key: 'weak', label: '待加強', tone: 'bad' }
  if (s.score < 80 || s.attempts < 5) return { key: 'mid', label: '進步中', tone: 'mid' }
  return { key: 'good', label: '已掌握', tone: 'good' }
}

/** 依掌握度給建議難度（數學）：1 基礎、2 標準、3 進階 */
export function levelForScore(score: number): 1 | 2 | 3 {
  if (score < 45) return 1
  if (score < 75) return 2
  return 3
}

/** 題庫難度 1–5 → 三級 */
export const toLevel = (d: number | null): 1 | 2 | 3 => (d == null || d <= 1 ? 1 : d === 2 ? 2 : 3)

/** 幾個知識點合併的平均掌握度（只算練過的） */
export function avgScore(stats: (KPStat | undefined)[]): number | null {
  const xs = stats.filter((s): s is KPStat => !!s && s.attempts > 0)
  return xs.length ? xs.reduce((a, s) => a + s.score, 0) / xs.length : null
}
