import type { SubjectKey } from './subjects'

// ── 知識點目錄（data/pool/catalog.json，scripts/build-bank.mjs 產生） ──
export type CatalogType = { code: string; name: string; n: number }
export type CatalogUnit = { code: string; title: string; chapter: string; n: number; types?: CatalogType[] }
/** 一冊：版本 → 單元表。數學、自然各版本題目共用（只差單元名稱）；英語只有 '*' */
export type CatalogBook = { total: number; pubs: Record<string, CatalogUnit[]> }
export type SubjectCatalog = { source: string; subject: SubjectKey; books: Record<string, CatalogBook> }

// ── 題目 ──
export type Question = {
  id: string
  subject: SubjectKey
  book: string
  /** 國文、社會的版本；其他科 '*' */
  pub: string
  unit: string
  unitTitle: string
  chapter: string
  /** 數學題型代號與名稱 */
  type?: string
  typeName?: string
  /** 1–5，只有數學有 */
  difficulty: number | null
  stem: string
  options: string[]
  answer: number
  /** verified＝原卷答案卷；ai＝兩個模型獨立作答一致（約 95% 正確） */
  answerStatus: 'verified' | 'ai'
  /** 出處（OLE-QS 授權條件：每題都要顯示，不可拿掉） */
  cite: string
}

/** 抽題目標：某單元（數學可再指定題型）抽幾題、偏好難度 */
export type DrawTarget = { unit: string; type?: string; n: number; level?: 1 | 2 | 3 }

// ── 學習紀錄（存在本機，lib/storage.ts） ──
/** 知識點練習進度；key 見 lib/kp.ts */
export type KPStat = { score: number; attempts: number; correct: number; recent: boolean[]; last: number }

export type AttemptLog = { qid: string; subject: SubjectKey; kp: string; correct: boolean; at: number; ms: number }

/** 錯題本一題：Leitner 間隔複習（lib/wrongbook.ts） */
export type WrongItem = {
  q: Question
  /** 最近一次選的答案（-1＝跳過） */
  chosen: number
  wrongCount: number
  firstWrongAt: number
  lastWrongAt: number
  /** 複習盒 0–5：答對一次往上一盒，答錯回 0；到 5 視為已克服 */
  box: number
  due: number
  mastered: boolean
  note?: string
}

export type SessionItem = { q: Question; chosen: number | null; correct?: boolean; ms?: number }
export type Session = {
  id: string
  mode: 'practice' | 'review'
  subject: SubjectKey | null
  book: string | null
  pub: string | null
  title: string
  startedAt: number
  endedAt?: number
  index: number
  items: SessionItem[]
  /** 開始時各知識點掌握度（報告比較前後用） */
  before: Record<string, number | null>
}

/** AI 詳解快取（同一題不重複花 AI 費用） */
export type AskRecord = {
  qid: string
  solution: string
  aiAnswer: string | null
  mismatch: boolean
  followups: { q: string; a: string; at: number }[]
  understood: boolean | null
  at: number
}

/** 學生回報可能有誤的題目（記下 id 交給題庫維護者，不改 OLE-QS） */
export type FlagItem = { qid: string; reason: string; at: number; auto?: boolean }
