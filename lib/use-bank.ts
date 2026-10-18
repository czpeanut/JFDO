'use client'

import { useEffect, useState } from 'react'
import type { Bank } from './types'

let cache: Bank | null = null
let pending: Promise<Bank> | null = null

/** 題庫索引（public/bank/index.json）：整個 app 只下載一次 */
export function loadBank(): Promise<Bank> {
  if (cache) return Promise.resolve(cache)
  pending ??= fetch('/bank/index.json').then(r => { if (!r.ok) throw new Error('題庫載入失敗'); return r.json() as Promise<Bank> })
    .then(b => { cache = b; return b }).catch(e => { pending = null; throw e })
  return pending
}

export function useBank(): { bank: Bank | null; error: string | null } {
  const [bank, setBank] = useState<Bank | null>(cache)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (!cache) loadBank().then(setBank).catch(e => setError(e instanceof Error ? e.message : '題庫載入失敗')) }, [])
  return { bank, error }
}
