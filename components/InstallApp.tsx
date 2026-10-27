'use client'

// 「安裝 App／加到主畫面」（做法同 Self-learning-sys，版型改成 v2）
//  - Android／Chrome／Edge：攔下 beforeinstallprompt，按一下就跳出系統安裝視窗
//  - iPhone／iPad（Safari）：蘋果不提供安裝 API，只能顯示「分享 → 加入主畫面」圖解
//  - LINE／Facebook／IG 內建瀏覽器：無法安裝，引導改用系統瀏覽器開啟
//  - 已經是安裝後的 App（standalone）就不顯示
//
// 瀏覽器規定：系統安裝視窗一定要由使用者「點一下」才能叫出來（prompt() 需要使用者手勢），
// 所以「主動跳窗」＝ 我們自己的視窗自動出現 → 學生點一下「一鍵安裝」→ 系統安裝視窗。

import { useCallback, useEffect, useState } from 'react'
import { withBase } from '@/lib/base'
import { Corners } from './ui'

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
type Env = 'installable' | 'ios' | 'in-app' | 'other' | 'installed'
declare global { interface Window { __bip?: BeforeInstallPromptEvent | null } }

function detect(): Env {
  const nav = navigator as Navigator & { standalone?: boolean }
  if (window.matchMedia('(display-mode: standalone)').matches || nav.standalone) return 'installed'
  if (window.__bip) return 'installable'
  const ua = navigator.userAgent
  if (/Line\/|FBAN|FBAV|Instagram/i.test(ua)) return 'in-app'
  const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  return iOS ? 'ios' : 'other'
}

/** 共用的安裝狀態：env 目前環境；install() 叫出系統安裝視窗（只在 installable 時有效） */
function useInstall() {
  const [env, setEnv] = useState<Env | null>(null)
  useEffect(() => {
    setEnv(detect())
    const refresh = () => setEnv(detect())
    const onInstalled = () => setEnv('installed')
    window.addEventListener('bip-ready', refresh)
    window.addEventListener('appinstalled', onInstalled)
    return () => { window.removeEventListener('bip-ready', refresh); window.removeEventListener('appinstalled', onInstalled) }
  }, [])
  const install = useCallback(async (): Promise<boolean> => {
    const e = window.__bip
    if (!e) return false
    await e.prompt()
    const { outcome } = await e.userChoice
    window.__bip = null                       // 同一個事件只能用一次
    setEnv(outcome === 'accepted' ? 'installed' : detect())
    return outcome === 'accepted'
  }, [])
  return { env, install }
}

const navBtn: React.CSSProperties = { background: 'var(--color-accent)', color: '#fff', border: 0, cursor: 'pointer', padding: '4px 10px' }

// ── 手動入口：導覽列按鈕／頁面區塊 ──────────────────────────────
export default function InstallApp({ variant = 'nav' }: { variant?: 'nav' | 'block' }) {
  const { env, install } = useInstall()
  const [open, setOpen] = useState(false)

  // 桌機 Firefox 等不支援安裝的環境，導覽列就不佔位置
  if (!env || env === 'installed' || (env === 'other' && variant === 'nav')) return null

  const click = async () => { if (env === 'installable') await install(); else setOpen(true) }

  return (
    <>
      {variant === 'nav' ? (
        <button onClick={click} className="v2-mono" style={navBtn}>安裝 App</button>
      ) : (
        <div className="flex flex-wrap items-center" style={{ gap: 12, padding: '0 22px 18px' }}>
          <span className="v2-muted" style={{ fontSize: 13, flex: 1, minWidth: 200 }}>加到主畫面，像 App 一樣全螢幕開啟，不用每次找網址。</span>
          <button className="v2-btn v2-btn-primary v2-btn-sm" onClick={click}>{env === 'installable' ? '一鍵安裝' : '怎麼安裝？'}</button>
        </div>
      )}
      {open && (
        <Sheet onClose={() => setOpen(false)}>
          <div className="v2-label">INSTALL</div>
          <h2 style={{ fontSize: 22 }}>加到主畫面</h2>
          <Steps env={env} />
          <button className="v2-btn" style={{ width: '100%' }} onClick={() => setOpen(false)}>知道了</button>
        </Sheet>
      )}
    </>
  )
}

// ── 主動跳窗：進站幾秒後自動出現 ─────────────────────────────────
const SNOOZE_KEY = 'jfdo:install-snooze'   // 裝置層級（不分學生）
const SNOOZE_DAYS = 3
const DELAY_MS = 4000

export function InstallPopup() {
  const { env, install } = useInstall()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!env || env === 'installed' || env === 'other') return
    try {
      const until = Number(localStorage.getItem(SNOOZE_KEY) ?? 0)
      if (until && Date.now() < until) return
    } catch { /* 無法讀取就照常顯示 */ }
    const t = setTimeout(() => setShow(true), DELAY_MS)
    return () => clearTimeout(t)
  }, [env])

  if (!show || !env || env === 'installed' || env === 'other') return null

  const snooze = (days: number) => {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + days * 86400000)) } catch { /* 忽略 */ }
    setShow(false)
  }

  return (
    <Sheet onClose={() => snooze(SNOOZE_DAYS)}>
      <div className="flex items-center" style={{ gap: 14 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={withBase('/icons/icon-192.png')} alt="" style={{ width: 56, height: 56 }} />
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600 }}>安裝 JFDO 題庫練習</div>
          <div className="v2-muted" style={{ fontSize: 13 }}>加到主畫面，下次一點就開、全螢幕更專心；可下載題庫離線練習</div>
        </div>
      </div>
      {env === 'installable' ? (
        <button className="v2-btn v2-btn-primary" style={{ width: '100%' }} onClick={async () => { if (await install()) setShow(false); else snooze(SNOOZE_DAYS) }}>
          一鍵安裝
        </button>
      ) : (
        <Steps env={env} />
      )}
      <div className="flex justify-between">
        <button className="v2-link v2-mono" onClick={() => snooze(SNOOZE_DAYS)}>以後再說</button>
        <button className="v2-mono v2-muted" style={{ background: 'none', border: 0, cursor: 'pointer' }} onClick={() => snooze(3650)}>不要再提醒</button>
      </div>
    </Sheet>
  )
}

// ── 共用 UI ─────────────────────────────────────────────────────
function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="no-print fixed inset-0 flex items-end justify-center sm:items-center" style={{ zIndex: 60, background: 'rgba(29,31,32,.45)', padding: 16 }} onClick={onClose}>
      <div role="dialog" aria-modal="true" className="blueprint flex flex-col" style={{ width: '100%', maxWidth: 380, gap: 16, padding: '22px 20px', background: 'var(--color-bg)' }}
        onClick={e => e.stopPropagation()}>
        {children}
        <Corners />
      </div>
    </div>
  )
}

function Steps({ env }: { env: Env }) {
  const ol: React.CSSProperties = { margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.8 }
  if (env === 'ios') {
    return (
      <ol style={ol}>
        <li>請用 <b>Safari</b> 開啟本頁（iPhone 上其他瀏覽器可能沒有此選項）</li>
        <li>點下方工具列的 <b>分享</b> 按鈕 <span className="v2-tag">⬆︎</span></li>
        <li>往下滑，選 <b>「加入主畫面」</b></li>
        <li>按右上角 <b>「新增」</b>，主畫面就會出現 JFDO 圖示</li>
      </ol>
    )
  }
  if (env === 'in-app') {
    const url = window.location.href
    // LINE 內建瀏覽器支援 openExternalBrowser=1，直接跳到系統瀏覽器
    const external = url + (url.includes('?') ? '&' : '?') + 'openExternalBrowser=1'
    return (
      <div className="flex flex-col" style={{ gap: 8, fontSize: 14 }}>
        <p style={{ margin: 0 }}>你現在在 LINE／Facebook 的內建瀏覽器裡，這裡沒辦法安裝。</p>
        <a href={external} className="v2-btn v2-btn-primary">用手機瀏覽器開啟</a>
        <p className="v2-muted" style={{ margin: 0, fontSize: 12 }}>若沒有反應：點右上角「⋯」→「用預設瀏覽器開啟」，再按「安裝 App」。</p>
      </div>
    )
  }
  return (
    <ol style={ol}>
      <li>Android：用 <b>Chrome</b> 開啟本頁，點右上角「⋮」→ <b>「安裝應用程式」</b>或<b>「加到主畫面」</b></li>
      <li>電腦：用 Chrome／Edge 開啟，網址列右側會有 <b>安裝</b> 圖示</li>
    </ol>
  )
}
