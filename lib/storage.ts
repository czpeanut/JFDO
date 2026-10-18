'use client'

// 資料層：全部存在本機 localStorage，依目前學生（裝置帳號）切換命名空間。
// 一題作答的所有副作用（掌握度、作答紀錄、錯題本）都集中在 recordAnswer。

import { kpsOf } from './kp'
import { updateStat } from './mastery'
import { isDue, recordRight, recordWrong } from './wrongbook'
import type { SubjectKey } from './subjects'
import type { AskRecord, AttemptLog, FlagItem, KPStat, Question, Session, WrongItem } from './types'

const ROOT = 'jfdo'
const MAX_ATTEMPTS = 20000
const MAX_SESSIONS = 60
const MAX_ASKS = 400

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
export type Profile = { id: string; name: string; grade?: string; createdAt: number }
export const listProfiles = () => read<Profile[]>(`${ROOT}:profiles`, [])
export const currentProfileId = () => read<string | null>(`${ROOT}:current`, null)
export function currentProfile(): Profile | null {
  const id = currentProfileId()
  return listProfiles().find(p => p.id === id) ?? null
}
export function createProfile(name: string, grade?: string): Profile {
  const p: Profile = { id: Math.random().toString(36).slice(2, 10), name: name.trim().slice(0, 20), grade, createdAt: Date.now() }
  write(`${ROOT}:profiles`, [...listProfiles(), p])
  write(`${ROOT}:current`, p.id)
  return p
}
export const switchProfile = (id: string | null) => write(`${ROOT}:current`, id)
export function deleteProfile(id: string) {
  write(`${ROOT}:profiles`, listProfiles().filter(p => p.id !== id))
  if (hasLS()) for (const k of Object.keys(localStorage)) if (k.startsWith(`${ROOT}:u:${id}:`)) localStorage.removeItem(k)
  if (currentProfileId() === id) switchProfile(null)
}

const k = (name: string) => `${ROOT}:u:${currentProfileId() ?? 'guest'}:${name}`

// ── 偏好 ──
export type Prefs = { subject: SubjectKey; book: string; pub: string; count: number }
export const getPrefs = (): Prefs => ({ subject: '數學', book: '7-1', pub: '翰林', count: 10, ...read<Partial<Prefs>>(k('prefs'), {}) })
export const setPrefs = (p: Partial<Prefs>) => write(k('prefs'), { ...getPrefs(), ...p })

// ── 掌握度與作答紀錄 ──
export const getStats = () => read<Record<string, KPStat>>(k('stats'), {})
export const getAttempts = () => read<AttemptLog[]>(k('attempts'), [])

/** 做過的題號（抽題時避開） */
export function doneIds(subject: SubjectKey): string[] {
  return [...new Set(getAttempts().filter(a => a.subject === subject).map(a => a.qid))]
}

/** 作答一題：更新掌握度、作答紀錄、錯題本。chosen = -1 代表跳過（照答錯算） */
export function recordAnswer(q: Question, chosen: number, ms: number, now = Date.now()): { correct: boolean } {
  const correct = chosen === q.answer
  const stats = getStats()
  for (const key of kpsOf(q)) stats[key] = updateStat(stats[key], correct, q.difficulty, now)
  write(k('stats'), stats)

  const logs = getAttempts()
  logs.push({ qid: q.id, subject: q.subject, kp: kpsOf(q)[0], correct, at: now, ms: Math.round(ms) })
  write(k('attempts'), logs.slice(-MAX_ATTEMPTS))

  const wrong = getWrongBook()
  if (!correct) wrong[q.id] = recordWrong(wrong[q.id], q, chosen, now)
  else if (wrong[q.id]) wrong[q.id] = recordRight(wrong[q.id], now)
  write(k('wrong'), wrong)
  return { correct }
}

// ── 錯題本 ──
export const getWrongBook = () => read<Record<string, WrongItem>>(k('wrong'), {})
export function saveWrong(item: WrongItem) { const w = getWrongBook(); w[item.q.id] = item; write(k('wrong'), w) }
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

// ── AI 詳解快取 ──
export const getAsk = (qid: string) => read<Record<string, AskRecord>>(k('asks'), {})[qid] ?? null
export function saveAsk(q: Question, patch: Partial<AskRecord>): AskRecord {
  const all = read<Record<string, AskRecord>>(k('asks'), {})
  const base: AskRecord = all[q.id] ?? { qid: q.id, solution: '', aiAnswer: null, mismatch: false, followups: [], understood: null, at: 0 }
  const rec: AskRecord = { ...base, ...patch, qid: q.id, at: Date.now() }
  all[q.id] = rec
  const entries = Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, MAX_ASKS)
  write(k('asks'), Object.fromEntries(entries))
  if (patch.mismatch) addFlag(q.id, `AI 詳解答案（${patch.aiAnswer ?? '?'}）與題庫答案不同`, true)
  return rec
}

// ── 回報有誤的題目 ──
export const getFlags = () => read<FlagItem[]>(k('flags'), [])
export function addFlag(qid: string, reason: string, auto = false) {
  const list = getFlags().filter(f => f.qid !== qid)
  list.unshift({ qid, reason: reason.slice(0, 200), at: Date.now(), ...(auto ? { auto } : {}) })
  write(k('flags'), list.slice(0, 500))
}
export const removeFlag = (qid: string) => write(k('flags'), getFlags().filter(f => f.qid !== qid))

// ── 備份 ──
const DATA_KEYS = ['prefs', 'stats', 'attempts', 'wrong', 'sessions', 'asks', 'flags']
export function exportData(): string {
  return JSON.stringify({ app: 'jfdo', version: 1, profile: currentProfile(), exportedAt: Date.now(), data: Object.fromEntries(DATA_KEYS.map(n => [n, read(k(n), null)])) })
}
export function importData(json: string): boolean {
  try {
    const d = JSON.parse(json) as { app?: string; data?: Record<string, unknown> }
    if (d.app !== 'jfdo' || !d.data) return false
    for (const n of DATA_KEYS) if (d.data[n] != null) write(k(n), d.data[n])
    return true
  } catch { return false }
}
