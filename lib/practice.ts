// 批改與選題（純函式）

import { leafOf } from './bank'
import { allocate, interleave } from './plan'
import type { AttemptLog, BankQuestion, KPStat, Response } from './types'

/**
 * 自動批改：選項題要選得完全一樣（多選全對才算對）、是非題比對 ○╳。
 * 看答案自評的題目回 null（由學生按「我答對了／答錯了」）；「不會」一律算錯。
 */
export function grade(q: BankQuestion, r: Response): boolean | null {
  if (r === 'skip') return false
  if (r === 'self') return null
  if (q.kind === 'choice' && Array.isArray(r) && Array.isArray(q.answer)) {
    const a = [...q.answer].sort((x, y) => x - y), b = [...new Set(r)].sort((x, y) => x - y)
    return a.length === b.length && a.every((v, i) => v === b[i])
  }
  if (q.kind === 'tf' && typeof r === 'boolean') return r === q.answer
  return null
}

/** 每題最近一次作答 */
export function lastAttempts(logs: AttemptLog[]): Map<string, AttemptLog> {
  const m = new Map<string, AttemptLog>()
  for (const a of logs) m.set(a.qid, a)
  return m
}

const shuffle = <T,>(a: T[], rnd: () => number) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }

/**
 * 從選的題型出 count 題：
 *  1. 依掌握度分配各題型題數（lib/plan.ts）
 *  2. 題型內：沒做過的優先（照原文件順序，由淺入深）→ 上次做錯的 → 最久沒做的
 *  3. 交錯排列，同題型不連續出
 */
export function pickQuestions(
  leaves: string[], byLeaf: Map<string, BankQuestion[]>, stats: Record<string, KPStat>,
  last: Map<string, AttemptLog>, count: number, rnd: () => number = Math.random,
): BankQuestion[] {
  const counts = allocate(count, leaves.map(key => ({ key, available: byLeaf.get(key)?.length ?? 0, stat: stats[key] })))
  const picked: BankQuestion[] = []
  for (const key of leaves) {
    const n = counts.get(key) ?? 0
    if (!n) continue
    const qs = byLeaf.get(key) ?? []
    const fresh = qs.filter(q => !last.has(q.id))
    const wrong = shuffle(qs.filter(q => last.get(q.id)?.correct === false), rnd)
    const old = qs.filter(q => last.get(q.id)?.correct === true).sort((a, b) => last.get(a.id)!.at - last.get(b.id)!.at)
    picked.push(...[...fresh, ...wrong, ...old].slice(0, n))
  }
  return interleave(picked, leafOf)
}
