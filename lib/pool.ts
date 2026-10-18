// 題目池（server 端）：讀 data/pool/（scripts/build-bank.mjs 從 OLE-QS 匯出檔唯讀產生，建置時自動產生）。

import fs from 'fs'
import path from 'path'
import { toLevel } from './mastery'
import { isBook, subjectInfo, type SubjectKey } from './subjects'
import type { CatalogBook, CatalogUnit, DrawTarget, Question, SubjectCatalog } from './types'

type PoolQuestion = { id: string; u: string; p?: string; t?: string; d: number | null; s: string; o: string[]; a: number; v: 0 | 1; c: string }
type Catalog = { source: string; builtAt: string; total: number; subjects: Record<string, Record<string, CatalogBook>> }

const DIR = () => path.join(process.cwd(), 'data', 'pool')
let catalogCache: Catalog | null | undefined
const shards = new Map<string, PoolQuestion[] | null>()

function loadCatalog(): Catalog | null {
  if (catalogCache === undefined) {
    try { catalogCache = JSON.parse(fs.readFileSync(path.join(DIR(), 'catalog.json'), 'utf8')) as Catalog } catch { catalogCache = null }
  }
  return catalogCache
}

function loadShard(subject: SubjectKey, book: string): PoolQuestion[] | null {
  const key = `${subject}/${book}`
  if (!shards.has(key)) {
    try {
      shards.set(key, (JSON.parse(fs.readFileSync(path.join(DIR(), subject, `${book}.json`), 'utf8')) as { questions: PoolQuestion[] }).questions)
    } catch { shards.set(key, null) }
  }
  return shards.get(key) ?? null
}

export function poolInfo(): { built: boolean; total: number; source: string | null } {
  const c = loadCatalog()
  return { built: !!c, total: c?.total ?? 0, source: c?.source ?? null }
}

export function subjectCatalog(subject: string): SubjectCatalog | null {
  const c = loadCatalog()
  const info = subjectInfo(subject)
  if (!c || !info) return null
  return { source: c.source, subject: info.key, books: c.subjects[info.key] ?? {} }
}

/** 單元名稱：國文社會用該版本；數學自然用學生的版本，沒有就退回其他版本 */
function findUnit(book: CatalogBook | undefined, pub: string, code: string): CatalogUnit | undefined {
  if (!book) return undefined
  for (const p of [pub, '*', '翰林', '康軒', '南一']) {
    const u = book.pubs[p]?.find(x => x.code === code)
    if (u) return u
  }
  return undefined
}

const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }

/**
 * 依抽題目標抽題：
 *  1. 優先沒做過的題目（exclude＝學生做過的題號）
 *  2. 有建議難度（數學）時，難度越接近越優先
 *  3. 新題用完才重出做過的題
 */
export function draw(subject: SubjectKey, book: string, pub: string, targets: DrawTarget[], exclude: Set<string>): Question[] {
  const info = subjectInfo(subject)
  if (!info || !isBook(book)) return []
  const qs = loadShard(subject, book)
  const cat = loadCatalog()?.subjects[subject]?.[book]
  if (!qs) return []
  const taken = new Set<string>()
  const out: Question[] = []
  for (const t of targets) {
    const all = qs.filter(q => q.u === t.unit && (!info.perPublisher || q.p === pub) && (!t.type || q.t === t.type) && !taken.has(q.id))
    const rank = (q: PoolQuestion) => (t.level ? Math.abs(toLevel(q.d) - t.level) : 0) + Math.random() * 0.8
    const fresh = shuffle(all.filter(q => !exclude.has(q.id))).sort((a, b) => rank(a) - rank(b))
    const seen = shuffle(all.filter(q => exclude.has(q.id)))
    const unit = findUnit(cat, pub, t.unit)
    for (const q of [...fresh, ...seen].slice(0, Math.max(0, Math.min(t.n, 50)))) {
      taken.add(q.id)
      out.push({
        id: q.id, subject: info.key, book, pub: info.perPublisher ? pub : '*',
        unit: q.u, unitTitle: unit?.title ?? q.u, chapter: unit?.chapter ?? '',
        ...(q.t ? { type: q.t, typeName: unit?.types?.find(x => x.code === q.t)?.name ?? '其他題型' } : {}),
        difficulty: q.d, stem: q.s, options: q.o, answer: q.a,
        answerStatus: q.v ? 'verified' : 'ai', cite: q.c,
      })
    }
  }
  return out
}
