// 錯題本（純函式）：Leitner 間隔複習。
// 答錯 → 回第 0 盒，隔天複習；複習答對 → 往上一盒，間隔 1/2/4/7/15 天；第 5 盒答對＝已克服。

import type { Response, WrongItem } from './types'

const DAY = 86400000
export const INTERVAL_DAYS = [1, 2, 4, 7, 15]
export const MASTER_BOX = 5
/** 已克服的題目不再到期（不用 Infinity：存進 localStorage 的 JSON 會變成 null） */
export const NEVER = 8.64e15

/** 某時間點「之後第 days 天的凌晨 4 點」：同一天內做的錯題，隔天一早就到期 */
export function dayStart(t: number, days: number): number {
  const d = new Date(t - 4 * 3600000)
  d.setHours(4, 0, 0, 0)
  return d.getTime() + days * DAY
}

export function recordWrong(prev: WrongItem | undefined, qid: string, response: Response, now = Date.now()): WrongItem {
  return {
    ...prev,
    qid, response,
    wrongCount: (prev?.wrongCount ?? 0) + 1,
    firstWrongAt: prev?.firstWrongAt ?? now,
    lastWrongAt: now,
    box: 0,
    due: dayStart(now, 1),
    mastered: false,
  }
}

/** 答對錯題本裡的題目：到期了才升盒（還沒到期就答對，不算一次間隔複習） */
export function recordRight(prev: WrongItem, now = Date.now()): WrongItem {
  if (prev.mastered || prev.due > now) return prev
  const box = prev.box + 1
  if (box >= MASTER_BOX) return { ...prev, box: MASTER_BOX, mastered: true, due: NEVER }
  return { ...prev, box, due: dayStart(now, INTERVAL_DAYS[box]) }
}

export const isDue = (w: WrongItem, now = Date.now()) => !w.mastered && w.due <= now

export function markMastered(w: WrongItem, mastered: boolean, now = Date.now()): WrongItem {
  return mastered ? { ...w, mastered: true, box: MASTER_BOX, due: NEVER } : { ...w, mastered: false, box: 0, due: now }
}

/** 複習順序：到期最久的先、錯越多次越前面 */
export const reviewOrder = (a: WrongItem, b: WrongItem) => a.due - b.due || b.wrongCount - a.wrongCount
