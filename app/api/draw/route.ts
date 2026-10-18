import { NextResponse } from 'next/server'
import { draw } from '@/lib/pool'
import { isBook, isPublisher, subjectInfo } from '@/lib/subjects'
import type { DrawTarget } from '@/lib/types'

type Body = { subject: string; book: string; pub: string; targets: DrawTarget[]; exclude?: string[] }

// 依抽題目標從題庫抽題（分配邏輯在前端 lib/plan.ts，依學生的掌握度決定）
export async function POST(req: Request) {
  let body: Body
  try { body = await req.json() } catch { return NextResponse.json({ error: '請求格式錯誤' }, { status: 400 }) }
  const info = subjectInfo(String(body.subject))
  const book = String(body.book)
  const pub = String(body.pub)
  if (!info || !isBook(book) || !isPublisher(pub) || !Array.isArray(body.targets) || body.targets.length === 0 || body.targets.length > 80) {
    return NextResponse.json({ error: '練習範圍不完整' }, { status: 400 })
  }
  const targets = body.targets.map(t => ({
    unit: String(t.unit).slice(0, 40), ...(t.type ? { type: String(t.type).slice(0, 20) } : {}),
    n: Math.max(0, Math.min(50, Number(t.n) || 0)),
    ...(t.level === 1 || t.level === 2 || t.level === 3 ? { level: t.level } : {}),
  }))
  if (targets.reduce((s, t) => s + t.n, 0) > 100) return NextResponse.json({ error: '一次最多 100 題' }, { status: 400 })
  const exclude = new Set((Array.isArray(body.exclude) ? body.exclude : []).slice(-5000).map(String))
  const questions = draw(info.key, book, pub, targets, exclude)
  if (!questions.length) return NextResponse.json({ error: '題庫裡找不到這個範圍的題目' }, { status: 404 })
  return NextResponse.json({ questions })
}
