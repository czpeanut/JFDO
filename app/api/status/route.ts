import { NextResponse } from 'next/server'
import { hasGemini } from '@/lib/ai'
import { poolInfo } from '@/lib/pool'
import { SOLVE_MODEL } from '@/lib/solve'

export const dynamic = 'force-dynamic'

export async function GET() {
  const pool = poolInfo()
  return NextResponse.json({ ai: hasGemini(), model: hasGemini() ? SOLVE_MODEL : null, bank: pool })
}
