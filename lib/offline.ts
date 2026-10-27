'use client'

// 離線使用：把整個題庫（索引＋所有題目／答案／詳解圖）存進瀏覽器快取，
// 安裝成 App 後沒有網路也能練習。快取名稱與 public/sw.js 的 BANK_CACHE 相同，Service Worker 會直接從這裡取圖。

import { withBase } from './base'
import type { Bank } from './types'

const BANK_CACHE = 'jfdo-bank'

export const offlineSupported = () => typeof window !== 'undefined' && 'caches' in window && 'serviceWorker' in navigator

/** 題庫所有圖片的網址（與 <img src> 相同的編碼方式，快取才對得上） */
export function bankUrls(bank: Bank): string[] {
  const files = bank.questions.flatMap(q => [...q.img.q, ...(q.img.a ?? []), ...(q.img.s ?? [])])
  return [withBase('/bank/index.json'), ...files.map(f => encodeURI(withBase(f)))]
}

/** 已經存好的檔案數 */
export async function cachedCount(urls: string[]): Promise<number> {
  if (!offlineSupported()) return 0
  const cache = await caches.open(BANK_CACHE)
  const keys = new Set((await cache.keys()).map(r => new URL(r.url).pathname))
  return urls.filter(u => keys.has(new URL(u, location.href).pathname)).length
}

/** 下載還沒存的檔案（8 個一批），回報進度；回傳失敗數 */
export async function downloadAll(urls: string[], onProgress: (done: number, total: number) => void): Promise<number> {
  const cache = await caches.open(BANK_CACHE)
  const keys = new Set((await cache.keys()).map(r => new URL(r.url).pathname))
  const todo = urls.filter(u => keys.has(new URL(u, location.href).pathname) === false || u.endsWith('index.json'))
  let done = urls.length - todo.length, failed = 0
  onProgress(done, urls.length)
  for (let i = 0; i < todo.length; i += 8) {
    await Promise.all(todo.slice(i, i + 8).map(async u => {
      try {
        const res = await fetch(u, { cache: 'reload' })
        if (res.ok) await cache.put(u, res); else failed++
      } catch { failed++ }
      done++
    }))
    onProgress(done, urls.length)
  }
  return failed
}

/** 清掉離線題庫（釋放空間） */
export async function clearOffline(): Promise<void> {
  if (offlineSupported()) await caches.delete(BANK_CACHE)
}
