import { NextResponse } from 'next/server'
import { subjectCatalog } from '@/lib/pool'

// 某科的知識點目錄（單元、數學題型、題數），不含題目
export async function GET(req: Request) {
  const subject = new URL(req.url).searchParams.get('subject') ?? ''
  const cat = subjectCatalog(subject)
  if (!cat) return NextResponse.json({ error: '題目池還沒建置或科目不存在（執行 npm run bank）' }, { status: 404 })
  return NextResponse.json(cat, { headers: { 'Cache-Control': 'public, max-age=300' } })
}
