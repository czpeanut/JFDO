// JFDO Service Worker：讓安裝後的 App 開得快、沒網路也能練習。
// 部署路徑從註冊範圍推得（GitHub Pages 是 /JFDO/，Vercel 是 /）。
//   - api/*：一律不經過快取（問 AI 要即時）
//   - _next/static/*、icons/*：檔名帶版本 → 快取優先
//   - bank/*.png（題目／答案／詳解圖）：快取優先；學習進度頁的「下載題庫」會一次存好全部（lib/offline.ts，同一個快取）
//   - bank/index.json（題庫索引）：網路優先，斷線用快取（題庫更新時才拿得到新版）
//   - 頁面：網路優先，斷線時退回上次快取的頁面
//   - 換頁資料（Next.js 的 RSC，網址帶 _rsc= 或 RSC 標頭）：同樣網路優先＋快取，依路徑存（不含參數），斷線也能換頁
// 改版時調整 VERSION，舊的程式／頁面快取會在 activate 時清掉（題庫圖片快取 jfdo-bank 保留）。
const VERSION = 'v1'
const STATIC_CACHE = `jfdo-static-${VERSION}`
const PAGE_CACHE = `jfdo-pages-${VERSION}`
const BANK_CACHE = 'jfdo-bank'
const BASE = new URL(self.registration.scope).pathname          // 結尾有 /
const PAGES = ['', 'practice/', 'wrong-book/', 'progress/', 'habits/'].map(p => BASE + p)

const rscKey = path => path.replace(/\/index\.txt$/, '/').replace(/([^/])$/, '$1/') + '__rsc'

// 預存是「盡量做」：每個請求最多等 8 秒，失敗或逾時都略過，不能卡住安裝
const soft = promise => Promise.race([promise, new Promise(r => setTimeout(r, 8000))]).catch(() => {})

self.addEventListener('install', event => {
  event.waitUntil(caches.open(PAGE_CACHE).then(c => Promise.all(PAGES.flatMap(p => [
    soft(c.add(p)),
    // 靜態網頁（GitHub Pages）的換頁資料是 <頁面>/index.txt；伺服器版沒有這個檔就略過
    soft(fetch(p + 'index.txt', { headers: { RSC: '1' } }).then(res => res.ok && c.put(rscKey(new URL(p, self.location.origin).pathname), res))),
  ]))))
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => ![STATIC_CACHE, PAGE_CACHE, BANK_CACHE].includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const cacheFirst = (req, name) =>
  caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(name).then(c => c.put(req, copy)) }
    return res
  }))

const networkFirst = (req, name, key = req) =>
  fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(name).then(c => c.put(key, copy)) }
    return res
  })

self.addEventListener('fetch', event => {
  const req = event.request
  const url = new URL(req.url)
  const path = url.pathname
  if (req.method !== 'GET' || url.origin !== self.location.origin || !path.startsWith(BASE) || path.startsWith(BASE + 'api/')) return

  if (url.searchParams.has('_rsc') || req.headers.get('RSC') === '1') {
    const key = rscKey(path)
    event.respondWith(networkFirst(req, PAGE_CACHE, key).catch(() => caches.match(key).then(hit => hit || Response.error())))
    return
  }
  if (path.startsWith(BASE + '_next/static/') || path.startsWith(BASE + 'icons/')) {
    event.respondWith(cacheFirst(req, STATIC_CACHE)); return
  }
  if (path === BASE + 'bank/index.json') {
    event.respondWith(networkFirst(req, BANK_CACHE).catch(() => caches.match(req))); return
  }
  if (path.startsWith(BASE + 'bank/')) {
    event.respondWith(cacheFirst(req, BANK_CACHE)); return
  }
  if (req.mode === 'navigate') {
    // 頁面依路徑快取（不含 ?id= 這類參數），斷線時同一頁的快取都能用
    const key = path.endsWith('/') ? path : path + '/'
    event.respondWith(
      networkFirst(req, PAGE_CACHE, key)
        .catch(() => caches.match(key).then(hit => hit || caches.match(path)).then(hit => hit || caches.match(BASE))),
    )
  }
})
