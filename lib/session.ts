'use client'

import { leafOf } from './bank'
import { getStats, saveSession } from './storage'
import type { BankQuestion, Session } from './types'

/** 建立一組練習並存起來，回傳 id（作答頁 /practice?id=） */
export function startSession(mode: Session['mode'], title: string, qs: BankQuestion[]): string {
  const stats = getStats()
  const before: Record<string, number | null> = {}
  for (const q of qs) { const l = leafOf(q); before[l] = stats[l]?.attempts ? stats[l].score : null }
  const s: Session = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    mode, title, startedAt: Date.now(), index: 0, before,
    items: qs.map(q => ({ qid: q.id })),
  }
  saveSession(s)
  return s.id
}
