// ── 題庫（public/bank/index.json，scripts/import_pdf.py 從 source/*.pdf 產生） ──
export type BankType = { id: string; title: string }
export type BankSub = { id: string; title: string; types: BankType[] }
export type BankKP = { id: string; title: string; subs: BankSub[] }
export type BankSection = { id: string; title: string; kps: BankKP[] }
export type BankChapter = { id: string; book: string; no: number; title: string; source: string; sections: BankSection[] }

export type BankQuestion = {
  id: string
  chapter: string
  section: string
  kp: string
  sub: string
  type: string
  /** 原文件的題號 */
  no: number
  /** choice＝選項題（自動批改，可能多選）；tf＝是非；open＝計算填充證明（看答案自己對） */
  kind: 'choice' | 'tf' | 'open'
  options?: number
  answer?: number[] | boolean
  single?: boolean
  /** 從 PDF 抽出的答案文字（數學式可能失真，只當參考，畫面一律顯示答案圖） */
  answerText?: string
  /** 正確答案（LaTeX，從答案圖轉寫，source/answers.tsv）；畫面優先顯示這個，沒有才用答案圖 */
  answerTex?: string
  /** 學測選填格式（scripts/build_fill.py）：有這個的計算／填充題改成填數字格、自動批改 */
  fill?: FillSpec
  /** 原文件沒附答案也沒附詳解：不出題 */
  noAnswer?: boolean
  /** 題目、答案、詳解圖（跨頁會有好幾張） */
  img: { q: string[]; a?: string[]; s?: string[] }
  /** 抽出的題目文字（失真，只用來搜尋） */
  text: string
}

/** 選填的一個小題：tex＝答案式（數字位置是 \boxed{編號}）、key＝每格正確字元、groups＝不限順序的各組格子範圍（相對本小題） */
export type FillPart = { label?: string; tex: string; key: string[]; groups?: [number, number][] }
export type FillSpec = { parts: FillPart[] }

export type Bank = { chapters: BankChapter[]; questions: BankQuestion[] }

// ── 學習紀錄（存在本機，lib/storage.ts） ──
/** 題型（知識點樹的最末層）的練習進度；key 見 lib/bank.ts 的 leafKey */
export type KPStat = { score: number; attempts: number; correct: number; recent: boolean[]; last: number }

export type AttemptLog = { qid: string; leaf: string; correct: boolean; at: number; ms: number }

/** 作答內容：選項題＝選的選項；是非＝true/false；選填＝每格填的字元；看答案自評＝'self'；不會＝'skip' */
export type Response = number[] | string[] | boolean | 'self' | 'skip'

export const ERROR_REASONS = ['觀念不熟', '計算錯誤', '看錯題目', '公式忘記', '完全不會'] as const
export type ErrorReason = (typeof ERROR_REASONS)[number]

/** 錯題本一題：Leitner 間隔複習（lib/wrongbook.ts） */
export type WrongItem = {
  qid: string
  response: Response
  wrongCount: number
  firstWrongAt: number
  lastWrongAt: number
  /** 複習盒 0–5：到期後答對往上一盒，答錯回 0；到 5 視為已克服 */
  box: number
  due: number
  mastered: boolean
  reason?: ErrorReason
  note?: string
}

export type Confidence = 'sure' | 'unsure' | 'guess'

/** ms＝作答時間（計算題算到按「對答案」）；answeredAt、reviewMs＝作答後看答案與詳解多久（學習行為剖析用） */
export type SessionItem = { qid: string; response?: Response; correct?: boolean; ms?: number; confidence?: Confidence; answeredAt?: number; reviewMs?: number }
export type Session = {
  id: string
  mode: 'practice' | 'review'
  title: string
  startedAt: number
  endedAt?: number
  index: number
  items: SessionItem[]
  /** 開始時各題型掌握度（結果頁比較前後用） */
  before: Record<string, number | null>
}

/** 問 AI 的紀錄（同一題不重複花 AI 費用） */
export type AskRecord = { qid: string; turns: { q: string; a: string; at: number }[]; at: number }

/** 學生回報可能有誤的題目（記下題目 id 交給題庫作者） */
export type FlagItem = { qid: string; reason: string; at: number }
