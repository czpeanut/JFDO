#!/usr/bin/env node
// 從 OLE-QS 官方匯出檔（data/export/，見 OLE-QS docs/USING_THE_BANK.md）產生題目池（不進版控，建置時產生）：
//   data/pool/catalog.json           各科各冊的知識點目錄（單元、數學題型）與題數
//   data/pool/<科目>/<冊別>.json      題目
//
// 用法：
//   node scripts/build-bank.mjs                    # 自動找匯出檔：$OLEQS_EXPORT → ../OLE-QS/data/export → 從 GitHub 下載
//   node scripts/build-bank.mjs --export <資料夾>
//   node scripts/build-bank.mjs --if-missing       # 題目池已存在就跳過（npm prebuild 用）
//
// 只讀 OLE-QS，不寫回。收錄條件（與 Self-learning-sys 相同）：
//   - status == reviewed、單選（type single、format choice）、2–5 個選項
//   - 答案可靠：原卷答案卷（answer_key_vlm、source_answer_key）或兩個模型獨立作答一致（ai:gemini+qwen）
//   - 純文字：沒有題幹圖、選項圖、題組、共用素材；題幹寫「如圖」的也排除（附圖不在 OLE-QS repo 裡）
//   - 有單元；題幹＋選項完全相同的只留一題（各校互相改編，匯出檔沒有去重）

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import readline from 'node:readline'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const POOL_DIR = path.join(ROOT, 'data', 'pool')
const CACHE = path.join(ROOT, '.cache', 'oleqs-export')
const RAW = 'https://raw.githubusercontent.com/czpeanut/OLE-QS/main/data/export'
const FILES = ['manifest.json', 'questions.jsonl.gz', 'taxonomy/math_patterns.json', 'taxonomy/curriculum.json']

const RELIABLE = new Set(['answer_key_vlm', 'source_answer_key', 'ai:gemini+qwen'])
const FIGURE_WORDS = /如圖|下圖|右圖|左圖|附圖|上圖|圖中|圖\s*[(（]?[一二三四五六七八九十\d]/
const PUBS = ['翰林', '康軒', '南一']
const OTHER = 'OTHER'
// 與 lib/subjects.ts 一致
const SUBJECTS = [
  { key: '數學', ole: '數學', sub: null, perPub: false },
  { key: '理化', ole: '自然', sub: '理化', perPub: false },
  { key: '生物', ole: '自然', sub: '生物', perPub: false },
  { key: '地科', ole: '自然', sub: '地科', perPub: false },
  { key: '英語', ole: '英語', sub: null, perPub: false },
  { key: '國文', ole: '國文', sub: null, perPub: true },
  { key: '歷史', ole: '社會', sub: '歷史', perPub: true },
  { key: '地理', ole: '社會', sub: '地理', perPub: true },
  { key: '公民', ole: '社會', sub: '公民', perPub: true },
]
const subjectOf = q => SUBJECTS.find(s => s.ole === q.subject && (s.sub ?? null) === (q.sub_subject ?? null))

const args = process.argv.slice(2)
const argVal = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined }

async function locateExport() {
  const cand = [argVal('--export'), process.env.OLEQS_EXPORT, path.join(ROOT, '..', 'OLE-QS', 'data', 'export'), CACHE].filter(Boolean)
  for (const d of cand) if (FILES.every(f => fs.existsSync(path.join(d, f)))) return d
  console.log(`找不到 OLE-QS 匯出檔，從 GitHub 下載到 ${path.relative(ROOT, CACHE)}/ …`)
  for (const f of FILES) {
    const res = await fetch(`${RAW}/${f}`)
    if (!res.ok) throw new Error(`下載 ${f} 失敗：HTTP ${res.status}`)
    fs.mkdirSync(path.dirname(path.join(CACHE, f)), { recursive: true })
    fs.writeFileSync(path.join(CACHE, f), Buffer.from(await res.arrayBuffer()))
  }
  return CACHE
}

async function* readQuestions(dir) {
  const rl = readline.createInterface({ input: fs.createReadStream(path.join(dir, 'questions.jsonl.gz')).pipe(zlib.createGunzip()), crlfDelay: Infinity })
  for await (const line of rl) if (line.trim()) yield JSON.parse(line)
}

// 單元排序：節次 1-1 < 1-2 < 2-1；國文「第十二課」用中文數字；其他（語文常識、英語主題）照字串
const CN = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }
function cnNum(t) {
  if (t.includes('十')) { const [a, b] = t.split('十'); return (a ? CN[a] ?? 1 : 1) * 10 + (b ? CN[b] ?? 0 : 0) }
  return CN[t] ?? 0
}
function unitSortKey(code) {
  const m = code.match(/^第([一二三四五六七八九十]+)課/)
  if (m) return [1, cnNum(m[1]), code]
  if (/^[\d-]+$/.test(code)) return [0, ...code.split('-').map(Number)]
  return [2, code]
}
const cmpCode = (a, b) => {
  const x = unitSortKey(a), y = unitSortKey(b)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if (x[i] === y[i]) continue
    if (x[i] === undefined) return -1
    if (y[i] === undefined) return 1
    return typeof x[i] === 'number' && typeof y[i] === 'number' ? x[i] - y[i] : String(x[i]).localeCompare(String(y[i]))
  }
  return 0
}
const inc = (m, k) => m.set(k, (m.get(k) ?? 0) + 1)

async function main() {
  if (args.includes('--if-missing') && fs.existsSync(path.join(POOL_DIR, 'catalog.json'))) {
    console.log('題目池已存在，略過（要重建請直接執行 node scripts/build-bank.mjs）')
    return
  }
  const dir = await locateExport()
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'))
  const patterns = JSON.parse(fs.readFileSync(path.join(dir, 'taxonomy/math_patterns.json'), 'utf8'))
  const curriculum = JSON.parse(fs.readFileSync(path.join(dir, 'taxonomy/curriculum.json'), 'utf8'))
  const source = `czpeanut/OLE-QS data/export @ ${manifest.exported_at}`
  console.log(`OLE-QS 匯出檔：${manifest.exported_at}，${manifest.questions} 題`)

  const pool = new Map()        // 科目/冊別 → 題目
  const counts = new Map()      // 科目/冊別 → Map(「版本|單元」或「版本|單元:題型」→ 題數)
  const titles = new Map()      // 科目/冊別 → Map(「版本|單元」→ [名稱, 章])，補課程表沒有的單元
  const seen = new Set()
  const skipped = new Map()
  const skip = why => inc(skipped, why)

  for await (const q of readQuestions(dir)) {
    if (q.status === 'rejected') continue
    const s = subjectOf(q)
    if (!s) { skip('科目不明（自然／社會未分子科）'); continue }
    if (!q.grade || !q.semester) { skip('沒有冊別'); continue }
    const book = `${q.grade}-${q.semester}`
    const unit = q.unit?.code
    if (!unit) { skip('沒有單元'); continue }
    const pub = s.perPub ? q.unit.publisher : '*'
    if (!pub || (s.perPub && !PUBS.includes(pub))) { skip('沒有版本'); continue }
    if (q.type !== 'single' || q.format !== 'choice') { skip('不是單選題'); continue }
    if (!RELIABLE.has(q.answer_source)) { skip('答案不夠可靠或沒有答案'); continue }
    const stem = (q.stem ?? '').trim()
    if (q.images?.length || q.shared_images?.length || q.group_id || q.group_stem || q.shared_text
        || (q.options ?? []).some(o => o.image) || FIGURE_WORDS.test(stem)) { skip('需要附圖或屬於題組'); continue }
    const opts = q.options ?? []
    const labels = opts.map(o => String(o.label ?? '').trim())
    if (!stem || !Array.isArray(q.answer) || q.answer.length !== 1 || !labels.includes(String(q.answer[0]).trim())
        || opts.length < 2 || opts.length > 5 || opts.some(o => !String(o.text ?? '').trim())) {
      skip('答案對不上選項'); continue
    }
    const h = crypto.createHash('sha1').update([stem, ...opts.map(o => o.text ?? '')].map(x => x.replace(/\s+/g, '')).join('\x1f')).digest('hex')
    if (seen.has(h)) { skip('重複題'); continue }
    seen.add(h)

    const sb = `${s.key}/${book}`
    const type = s.key === '數學' ? (q.pattern?.key?.split(':')[1] ?? OTHER) : undefined
    if (!pool.has(sb)) { pool.set(sb, []); counts.set(sb, new Map()); titles.set(sb, new Map()) }
    inc(counts.get(sb), `${pub}|${unit}`)
    if (type) inc(counts.get(sb), `${pub}|${unit}:${type}`)
    if (!titles.get(sb).has(`${pub}|${unit}`)) titles.get(sb).set(`${pub}|${unit}`, [q.unit.title ?? unit, q.unit.chapter ?? ''])
    pool.get(sb).push({
      id: q.id, u: unit, ...(s.perPub ? { p: pub } : {}), ...(type ? { t: type } : {}),
      d: q.difficulty ?? null, s: stem,
      o: opts.map(o => String(o.text).trim()),
      a: labels.indexOf(String(q.answer[0]).trim()),
      v: q.answer_source === 'ai:gemini+qwen' ? 0 : 1,
      c: [q.city, q.school_short, q.year ? `${q.year}學年` : null, q.exam_seq ? `第${q.exam_seq}次段考` : null].filter(Boolean).join(' '),
    })
  }

  // ── 知識點目錄 ──
  const curUnits = (s, g, sem, pub) => {
    if (s.key === '英語') {
      return (curriculum.english ?? []).filter(t => t.grade === g && t.semester === sem).map(t => ({ code: t.id, title: t.title, chapter: t.group ?? '' }))
    }
    const node = curriculum.junior?.[g]?.[sem]?.[s.ole]?.[s.sub ?? '']?.[pub] ?? []
    return node.map(it => ({ code: it.section ?? it.lesson, title: it.title, chapter: it.chapter_title || it.kind || '' })).filter(u => u.code)
  }
  const catalog = {}
  fs.rmSync(POOL_DIR, { recursive: true, force: true })
  let total = 0
  for (const [sb, qs] of [...pool.entries()].sort()) {
    const [key, book] = sb.split('/')
    const s = SUBJECTS.find(x => x.key === key)
    const [g, sem] = book.split('-').map(Number)
    const cnt = counts.get(sb)
    const pubs = {}
    // 數學、自然：各版本節次對齊，題目共用（版本只影響單元名稱）；英語：主題不分版本
    for (const pub of key === '英語' ? ['*'] : PUBS) {
      const ck = s.perPub ? pub : '*'
      const units = new Map(curUnits(s, g, sem, pub).map(u => [u.code, u]))
      // 課程表沒列、但題目有標的單元（跨冊複習、語文常識、英語字彙閱讀等）
      for (const [k, [title, chapter]] of titles.get(sb)) {
        const [p, code] = k.split('|')
        if (p === ck && !units.has(code) && (cnt.get(k) ?? 0) >= 5) units.set(code, { code, title, chapter })
      }
      const list = [...units.values()].map(u => {
        const n = cnt.get(`${ck}|${u.code}`) ?? 0
        const out = { ...u, n }
        if (key === '數學') {
          const types = (patterns[`${book}_${u.code}`]?.types ?? []).map(t => ({ code: t.code, name: t.name, n: cnt.get(`*|${u.code}:${t.code}`) ?? 0 }))
          const other = cnt.get(`*|${u.code}:${OTHER}`) ?? 0
          if (other) types.push({ code: OTHER, name: '其他題型', n: other })
          out.types = types.filter(t => t.n > 0)
        }
        return out
      }).filter(u => u.n > 0).sort((a, b) => cmpCode(a.code, b.code))
      if (list.length) pubs[pub] = list
    }
    ;(catalog[key] ??= {})[book] = { total: qs.length, pubs }

    qs.sort((a, b) => cmpCode(a.u, b.u) || (a.t ?? '').localeCompare(b.t ?? '') || a.id.localeCompare(b.id))
    fs.mkdirSync(path.join(POOL_DIR, key), { recursive: true })
    fs.writeFileSync(path.join(POOL_DIR, key, `${book}.json`), JSON.stringify({ source, subject: key, book, questions: qs }))
    total += qs.length
    console.log(`  ${key} ${book}：${qs.length} 題，${Object.entries(pubs).map(([p, l]) => `${p} ${l.length} 單元`).join('、')}`)
  }
  fs.writeFileSync(path.join(POOL_DIR, 'catalog.json'), JSON.stringify({ source, builtAt: new Date().toISOString(), total, subjects: catalog }))
  console.log(`題目池共 ${total} 題 → ${path.relative(ROOT, POOL_DIR)}/`)
  for (const [k, v] of [...skipped.entries()].sort((a, b) => b[1] - a[1])) console.log(`  排除 ${v} 題：${k}`)
}

main().catch(e => { console.error(e); process.exit(1) })
