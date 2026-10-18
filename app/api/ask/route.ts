import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import { hasGemini } from '@/lib/ai'
import { leafPath } from '@/lib/bank'
import { generateWithRetry, geminiErrorResponse } from '@/lib/gemini'
import { clientKey, rateLimit } from '@/lib/rate-limit'
import { TUTOR_MODEL, buildTutorPrompt } from '@/lib/tutor'
import type { Bank } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 150   // 與 student-app 相同：帶圖講解需要較長時間

let bankCache: Bank | null = null
function loadBank(): Bank {
  if (!bankCache) bankCache = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', 'bank', 'index.json'), 'utf8')) as Bank
  return bankCache
}

type Body = { qid: string; doubt: string; history?: { q: string; a: string }[] }

export async function POST(req: Request) {
  if (!hasGemini()) return NextResponse.json({ error: '尚未設定 AI（GEMINI_API_KEY）' }, { status: 503 })
  let body: Body
  try { body = await req.json() } catch { return NextResponse.json({ error: '請求格式錯誤' }, { status: 400 }) }
  const doubt = String(body.doubt ?? '').trim().slice(0, 200)
  const bank = loadBank()
  const q = bank.questions.find(x => x.id === String(body.qid))
  if (!q || !doubt) return NextResponse.json({ error: '請說說哪裡不懂' }, { status: 400 })

  // 每個來源 30 次／10 分鐘
  if (!rateLimit(`${clientKey(req)}:ask`, 30, 10 * 60000)) {
    return NextResponse.json({ error: '使用 AI 太頻繁了，先自己想一想，休息一下再試 🙂', kind: 'busy', retryable: true }, { status: 429 })
  }

  // 圖片只從題庫索引列出的路徑讀（public/bank/ 底下），不接受前端傳路徑
  const files = [...q.img.q, ...(q.img.a ?? []), ...(q.img.s ?? [])]
  const images = files.map(f => ({ inlineData: { data: fs.readFileSync(path.join(process.cwd(), 'public', f)).toString('base64'), mimeType: 'image/png' } }))
  const p = leafPath(bank, `${q.chapter}|${q.sub}|${q.type}`)
  const where = [p.chapter && `${p.chapter.book}第${p.chapter.no}章 ${p.chapter.title}`, p.section, p.sub, p.type].filter(Boolean).join(' › ')
  const prompt = buildTutorPrompt({
    where, doubt, hasSolution: !!q.img.s?.length,
    history: (body.history ?? []).slice(-3).map(h => ({ q: String(h.q).slice(0, 200), a: String(h.a).slice(0, 2000) })),
  })
  try {
    const reply = await generateWithRetry([prompt, ...images], { model: TUTOR_MODEL, thinkingBudget: 2048 })
    return NextResponse.json({ reply })
  } catch (e) {
    const { status, body: errBody } = geminiErrorResponse(e)
    return NextResponse.json(errBody, { status })
  }
}
