// 題庫結構與進度彙總（純函式，前後端都能用）。
// 知識點樹：章 → 節 → 知識點 → 子知識點 → 題型。進度記在最末層「題型」，上層一律由題型彙總。

import { avgScore } from './mastery'
import type { Bank, BankChapter, BankQuestion, KPStat } from './types'

/** 題型鍵：章|子知識點|題型（子知識點代號在章內唯一，例如 A-1） */
export const leafKey = (chapter: string, sub: string, type: string) => `${chapter}|${sub}|${type}`
export const leafOf = (q: BankQuestion) => leafKey(q.chapter, q.sub, q.type)

export type Node = { key: string; level: 'chapter' | 'section' | 'kp' | 'sub' | 'type'; code: string; title: string; leaves: string[] }

/** 某個節點底下的所有題型鍵 */
export function leavesOf(ch: BankChapter, filter?: { section?: string; kp?: string; sub?: string }): string[] {
  const out: string[] = []
  for (const s of ch.sections) {
    if (filter?.section && s.id !== filter.section) continue
    for (const kp of s.kps) {
      if (filter?.kp && kp.id !== filter.kp) continue
      for (const sub of kp.subs) {
        if (filter?.sub && sub.id !== filter.sub) continue
        for (const t of sub.types) out.push(leafKey(ch.id, sub.id, t.id))
      }
    }
  }
  return out
}

/** 可以出題的題目（排除原文件沒附答案的） */
export const practicable = (q: BankQuestion) => !q.noAnswer

export function questionsByLeaf(bank: Bank): Map<string, BankQuestion[]> {
  const m = new Map<string, BankQuestion[]>()
  for (const q of bank.questions) {
    if (!practicable(q)) continue
    const k = leafOf(q)
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(q)
  }
  for (const list of m.values()) list.sort((a, b) => a.no - b.no)
  return m
}

export type Progress = {
  /** 題庫題數、做過的不同題數 */
  total: number
  done: number
  attempts: number
  correct: number
  /** 練過的題型數／題型總數 */
  practicedLeaves: number
  leaves: number
  /** 練過的題型平均掌握度（沒練過＝null） */
  score: number | null
  /** 彙總成一個 KPStat（給 LevelBadge 用；attempts＝練過的題型數） */
  stat?: KPStat
}

/** 彙總一組題型的進度 */
export function progressOf(leaves: string[], stats: Record<string, KPStat>, byLeaf: Map<string, BankQuestion[]>, doneIds: Set<string>): Progress {
  let total = 0, done = 0, attempts = 0, correct = 0, practiced = 0
  for (const l of leaves) {
    const qs = byLeaf.get(l) ?? []
    total += qs.length
    done += qs.filter(q => doneIds.has(q.id)).length
    const s = stats[l]
    if (s && s.attempts > 0) { practiced++; attempts += s.attempts; correct += s.correct }
  }
  const score = avgScore(leaves.map(l => stats[l]))
  return {
    total, done, attempts, correct, practicedLeaves: practiced, leaves: leaves.length, score,
    ...(score != null ? { stat: { score, attempts, correct, recent: [], last: 0 } } : {}),
  }
}

/** 題型的完整名稱：「1-1 數與式 › A 有理數 › A-1 有理、無理判定 › 題型一 敘述判定」 */
export function leafPath(bank: Bank, key: string): { chapter?: BankChapter; section?: string; kp?: string; sub?: string; type?: string } {
  const [chId, subId, typeId] = key.split('|')
  const ch = bank.chapters.find(c => c.id === chId)
  if (!ch) return {}
  for (const s of ch.sections) for (const kp of s.kps) for (const sub of kp.subs) {
    if (sub.id !== subId) continue
    const t = sub.types.find(x => x.id === typeId)
    return { chapter: ch, section: `${s.id} ${s.title}`, kp: `${kp.id} ${kp.title}`, sub: `${sub.id} ${sub.title}`, type: t ? typeLabel(t.id, t.title) : undefined }
  }
  return { chapter: ch }
}

const CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
/** T3 → 題型三；T0（子知識點底下沒分題型）直接用名稱 */
export function typeLabel(id: string, title: string): string {
  const n = Number(id.slice(1))
  if (!n) return title
  return `題型${n <= 10 ? CN[n] : n}：${title}`
}

export const chapterLabel = (ch: BankChapter) => `${ch.book}第${CN[ch.no] ?? ch.no}章 ${ch.title}`
