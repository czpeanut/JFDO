import { NextResponse } from 'next/server'
import { hasGemini } from '@/lib/ai'
import { TUTOR_MODEL } from '@/lib/tutor'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ ai: hasGemini(), model: hasGemini() ? TUTOR_MODEL : null })
}
