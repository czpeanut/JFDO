'use client'

// 資料層：全部存在本機 localStorage，依目前學生（裝置帳號）切換命名空間。
// 一題作答的所有副作用（掌握度、作答紀錄、錯題本）都集中在 recordAnswer。

import { leafOf } from './bank'
import { updateStat } from './mastery'
import { isDue, recordRight, recordWrong } from './wrongbook'
import type { AskRecord, AttemptLog, BankQuestion, FlagItem, KPStat, Response, Session, WrongItem } from './types'

const ROOT = 'jfdo'
const MAX_ATTEMPTS = 20000
const MAX_SESSIONS = 60
const MAX_ASKS = 300

const hasLS = () => typeof window !== 'undefined' && !!window.localStorage
function read<T>(key: string, fallback: T): T {
  if (!hasLS()) return fallback
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback } catch { return fallback }
}
function write(key: string, v: unknown) {
  if (!hasLS()) return
  try { localStorage.setItem(key, JSON.stringify(v)) } catch (e) { console.warn('[storage] 寫入失敗（空間可能滿了）', e) }
}

// ── 學生（裝置帳號） ──
export type Profile = { id: string; name: string; createdAt: number }
export const listProfiles = () => read<Profile[]>(`${ROOT}:profiles`, [])
export const currentProfileId = () => read<string | null>(`${ROOT}:current`, null)
export function currentProfile(): Profile | null {
  const id = currentProfileId()
  return listProfiles().find(p => p.id === id) ?? null
}
export function createProfile(name: string): Profile {
  const p: Profile = { id: Math.random().toString(36).slice(2, 10), name: name.trim().slice(0, 20), createdAt: Date.now() }
  write(`${ROOT}:profiles`, [...listProfiles(), p])
  write(`${ROOT}:current`, p.id)
  return p
}
export const switchProfile = (id: string | null) => write(`${ROOT}:current`, id)
export function deleteProfile(id: string) {
  write(`${ROOT}:profiles`, listProfiles().filter(p => p.id !== id))
  if (hasLS()) for (const key of Object.keys(localStorage)) if (key.startsWith(`${ROOT}:u:${id}:`)) localStorage.removeItem(key)
  if (currentProfileId() === id) switchProfile(null)
}

const k = (name: string) => `${ROOT}:u:${currentProfileId() ?? 'guest'}:${name}`

// ── 偏好 ──
export type Prefs = { chapter: string | null; count: number; open: string[] }
export const getPrefs = (): Prefs => ({ chapter: null, count: 10, open: [], ...read<Partial<Prefs>>(k('prefs'), {}) })
export const setPrefs = (p: Partial<Prefs>) => write(k('prefs'), { ...getPrefs(), ...p })

// ── 掌握度與作答紀錄 ──
export const getStats = () => read<Record<string, KPStat>>(k('stats'), {})
export const getAttempts = () => read<AttemptLog[]>(k('attempts'), [])
export const doneIdSet = () => new Set(getAttempts().map(a => a.qid))

/** 作答一題：更新題型掌握度、作答紀錄、錯題本 */
export function recordAnswer(q: BankQuestion, response: Response, correct: boolean, ms: number, now = Date.now()) {
  const leaf = leafOf(q)
  const stats = getStats()
  stats[leaf] = updateStat(stats[leaf], correct, null, now)
  write(k('stats'), stats)

  const logs = getAttempts()
  logs.push({ qid: q.id, leaf, correct, at: now, ms: Math.round(ms) })
  write(k('attempts'), logs.slice(-MAX_ATTEMPTS))

  const wrong = getWrongBook()
  if (!correct) wrong[q.id] = recordWrong(wrong[q.id], q.id, response, now)
  else if (wrong[q.id]) wrong[q.id] = recordRight(wrong[q.id], now)
  write(k('wrong'), wrong)
}

// ── 錯題本 ──
export const getWrongBook = () => read<Record<string, WrongItem>>(k('wrong'), {})
export function saveWrong(item: WrongItem) { const w = getWrongBook(); w[item.qid] = item; write(k('wrong'), w) }
export function removeWrong(qid: string) { const w = getWrongBook(); delete w[qid]; write(k('wrong'), w) }
export const dueWrong = (now = Date.now()) => Object.values(getWrongBook()).filter(w => isDue(w, now))

// ── 練習紀錄 ──
export const getSessions = () => read<Session[]>(k('sessions'), [])
export const getSession = (id: string) => getSessions().find(s => s.id === id) ?? null
export function saveSession(s: Session) {
  const list = getSessions().filter(x => x.id !== s.id)
  list.unshift(s)
  write(k('sessions'), list.slice(0, MAX_SESSIONS))
}

// ── 問 AI 紀錄 ──
export const getAsk = (qid: string) => read<Record<string, AskRecord>>(k('asks'), {})[qid] ?? null
export function addAskTurn(qid: string, q: string, a: string): AskRecord {
  const all = read<Record<string, AskRecord>>(k('asks'), {})
  const rec: AskRecord = { qid, turns: [...(all[qid]?.turns ?? []), { q, a, at: Date.now() }], at: Date.now() }
  all[qid] = rec
  write(k('asks'), Object.fromEntries(Object.entries(all).sort((x, y) => y[1].at - x[1].at).slice(0, MAX_ASKS)))
  return rec
}

// ── 回報有誤的題目 ──
export const getFlags = () => read<FlagItem[]>(k('flags'), [])
export function addFlag(qid: string, reason: string) {
  const list = getFlags().filter(f => f.qid !== qid)
  list.unshift({ qid, reason: reason.slice(0, 200), at: Date.now() })
  write(k('flags'), list.slice(0, 500))
}
export const removeFlag = (qid: string) => write(k('flags'), getFlags().filter(f => f.qid !== qid))

// ── 備份 ──
const DATA_KEYS = ['prefs', 'stats', 'attempts', 'wrong', 'sessions', 'asks', 'flags']
export function exportData(): string {
  return JSON.stringify({ app: 'jfdo', version: 2, profile: currentProfile(), exportedAt: Date.now(), data: Object.fromEntries(DATA_KEYS.map(n => [n, read(k(n), null)])) })
}
export function importData(json: string): boolean {
  try {
    const d = JSON.parse(json) as { app?: string; version?: number; data?: Record<string, unknown> }
    if (d.app !== 'jfdo' || d.version !== 2 || !d.data) return false
    for (const n of DATA_KEYS) if (d.data[n] != null) write(k(n), d.data[n])
    return true
  } catch { return false }
}
