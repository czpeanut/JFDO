'use client'

// 從本機紀錄組出學習行為剖析的輸入（練習紀錄、問 AI、錯題本）

import { leafOf, leafPath } from './bank'
import { type AnswerEvent, type LearningProfile, buildLearningProfile } from './learning-profile'
import { askCount, getSessions, getWrongBook } from './storage'
import type { Bank } from './types'

export const dayStr = (d: Date = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function collectEvents(bank: Bank): AnswerEvent[] {
  const byId = new Map(bank.questions.map(q => [q.id, q]))
  const names = new Map<string, string>()
  const events: AnswerEvent[] = []
  for (const s of getSessions()) {
    const day = dayStr(new Date(s.startedAt))
    s.items.forEach((it, order) => {
      const q = byId.get(it.qid)
      if (!q || it.correct === undefined || it.response === undefined) return
      const skill = leafOf(q)
      if (!names.has(skill)) names.set(skill, leafPath(bank, skill).type ?? skill)
      const skipped = it.response === 'skip'
      events.push({
        session: s.id, order, day, timeMs: it.ms ?? 0, correct: it.correct, skipped,
        confidence: skipped ? 'guess' : it.confidence ?? 'unsure', kind: q.kind,
        ...(it.reviewMs != null ? { reviewMs: it.reviewMs } : {}),
        skill, skillName: names.get(skill)!,
      })
    })
  }
  return events
}

export function collectProfile(bank: Bank): LearningProfile {
  const now = Date.now()
  const book = Object.values(getWrongBook())
  return buildLearningProfile({
    events: collectEvents(bank),
    asks: askCount(),
    review: {
      overdue: book.filter(w => !w.mastered && w.due < now - 2 * 86400000).length,
      resolved: book.filter(w => w.mastered).length,
      total: book.length,
    },
    today: dayStr(),
  })
}
