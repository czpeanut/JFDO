// 知識點鍵：「科目|冊別|版本|單元」，數學題型再加「|題型」。
// 國文、社會的單元代號依版本不同，版本要一起記；其他科版本記 '*'（各版本節次對齊，換版本進度不會不見）。

import { subjectInfo, type SubjectKey } from './subjects'
import type { Question } from './types'

export const pubFor = (subject: SubjectKey, pub: string) => (subjectInfo(subject)?.perPublisher ? pub : '*')
export const unitKey = (subject: SubjectKey, book: string, pub: string, unit: string) => `${subject}|${book}|${pubFor(subject, pub)}|${unit}`
export const typeKey = (subject: SubjectKey, book: string, pub: string, unit: string, type: string) => `${unitKey(subject, book, pub, unit)}|${type}`

/** 一題作答會更新的知識點：單元，以及（數學）題型 */
export function kpsOf(q: Question): string[] {
  const u = unitKey(q.subject, q.book, q.pub, q.unit)
  return q.type ? [u, `${u}|${q.type}`] : [u]
}

export function parseKey(key: string): { subject: SubjectKey; book: string; pub: string; unit: string; type?: string } {
  const [subject, book, pub, unit, type] = key.split('|')
  return { subject: subject as SubjectKey, book, pub, unit, ...(type ? { type } : {}) }
}
