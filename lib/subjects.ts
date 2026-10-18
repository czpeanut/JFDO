// 科目與冊別設定。科目對應 OLE-QS 匯出檔的 subject／sub_subject（見 OLE-QS docs/USING_THE_BANK.md）。

export type SubjectKey = '國文' | '英語' | '數學' | '理化' | '生物' | '地科' | '歷史' | '地理' | '公民'

export type SubjectInfo = {
  key: SubjectKey
  icon: string
  /** OLE-QS subject／sub_subject */
  ole: string
  sub: string | null
  /** 單元代號依版本不同（國文、社會）：知識點要連同版本一起記 */
  perPublisher: boolean
  /** student-app 解題提示詞用的科目名稱（lib/solve.ts 的科目限制以此判斷） */
  solveName: string
}

export const SUBJECTS: SubjectInfo[] = [
  { key: '數學', icon: '📐', ole: '數學', sub: null, perPublisher: false, solveName: '數學' },
  { key: '理化', icon: '⚗️', ole: '自然', sub: '理化', perPublisher: false, solveName: '理化' },
  { key: '生物', icon: '🌱', ole: '自然', sub: '生物', perPublisher: false, solveName: '生物' },
  { key: '地科', icon: '🌏', ole: '自然', sub: '地科', perPublisher: false, solveName: '地球科學' },
  { key: '英語', icon: '🔤', ole: '英語', sub: null, perPublisher: false, solveName: '英文' },
  { key: '國文', icon: '📖', ole: '國文', sub: null, perPublisher: true, solveName: '國文' },
  { key: '歷史', icon: '🏛️', ole: '社會', sub: '歷史', perPublisher: true, solveName: '歷史' },
  { key: '地理', icon: '🗺️', ole: '社會', sub: '地理', perPublisher: true, solveName: '地理' },
  { key: '公民', icon: '⚖️', ole: '社會', sub: '公民', perPublisher: true, solveName: '公民' },
]

export const subjectInfo = (key: string): SubjectInfo | undefined => SUBJECTS.find(s => s.key === key)

export const BOOKS = ['7-1', '7-2', '8-1', '8-2', '9-1', '9-2'] as const
export type Book = (typeof BOOKS)[number]
export const BOOK_NAME: Record<string, string> = { '7-1': '七上', '7-2': '七下', '8-1': '八上', '8-2': '八下', '9-1': '九上', '9-2': '九下' }
export const isBook = (b: string): b is Book => (BOOKS as readonly string[]).includes(b)

export const PUBLISHERS = ['翰林', '康軒', '南一'] as const
export type Publisher = (typeof PUBLISHERS)[number]
export const isPublisher = (p: string): p is Publisher => (PUBLISHERS as readonly string[]).includes(p)
