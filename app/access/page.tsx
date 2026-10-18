'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function AccessPage() {
  return <Suspense><AccessForm /></Suspense>
}

function AccessForm() {
  const next = useSearchParams().get('next') || '/'
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const submit = async () => {
    setErr('')
    const res = await fetch('/api/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })
    if (res.ok) window.location.href = next.startsWith('/') ? next : '/'
    else setErr('通行碼不對')
  }
  return (
    <div className="flex items-center justify-center" style={{ padding: '60px 18px' }}>
      <div className="blueprint" style={{ width: '100%', maxWidth: 360, padding: '30px 24px' }}>
        <div className="v2-brand" style={{ padding: 0, marginBottom: 8, justifyContent: 'center' }}><span className="mark" />JFDO 題庫練習</div>
        <p className="v2-muted" style={{ textAlign: 'center', fontSize: 12, marginBottom: 20 }}>這台裝置第一次使用，請輸入通行碼</p>
        <div className="flex flex-col" style={{ gap: 10 }}>
          <input type="password" value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit() }} className="v2-input" autoFocus />
          {err && <div style={{ fontSize: 13, color: 'var(--color-accent-900)' }}>{err}</div>}
          <button className="v2-btn v2-btn-primary" disabled={!code} onClick={submit}>確認</button>
        </div>
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      </div>
    </div>
  )
}
