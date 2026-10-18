'use client'

// 裝置帳號：同一台平板／電腦可以有好幾位學生，每位的進度、錯題分開存（本機 localStorage）。
// 版型同 student-app v2 的登入畫面（blueprint 框＋四角標記）。

import { useEffect, useState } from 'react'
import { createProfile, currentProfile, deleteProfile, listProfiles, switchProfile, type Profile } from '@/lib/storage'

export default function ProfileGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [me, setMe] = useState<Profile | null>(null)
  const [list, setList] = useState<Profile[]>([])
  const [name, setName] = useState('')

  useEffect(() => { setMe(currentProfile()); setList(listProfiles()); setReady(true) }, [])

  if (!ready) return <div className="v2-root" style={{ minHeight: '100dvh' }} />
  if (me) return <>{children}</>

  const pick = (id: string) => { switchProfile(id); setMe(currentProfile()) }
  const add = () => { if (name.trim()) { createProfile(name); setMe(currentProfile()) } }

  return (
    <div className="v2-root flex items-center justify-center" style={{ minHeight: '100dvh', padding: '24px 18px' }}>
      <div className="blueprint" style={{ width: '100%', maxWidth: 380, padding: '34px 26px' }}>
        <div className="v2-brand" style={{ padding: 0, marginBottom: 8, justifyContent: 'center' }}><span className="mark" />JFDO 題庫練習</div>
        <p className="v2-muted" style={{ textAlign: 'center', fontSize: 12, marginBottom: 24 }}>單位知識題庫・知識點進度・錯題本・詳解</p>

        {list.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div className="v2-label" style={{ marginBottom: 6 }}>STUDENTS 選擇學生</div>
            {list.map(p => (
              <div key={p.id} className="flex items-center" style={{ gap: 10, padding: '10px 0', borderTop: '1px solid var(--color-divider)' }}>
                <button className="v2-link" style={{ flex: 1, textAlign: 'left', fontSize: 15, color: 'var(--color-text)' }} onClick={() => pick(p.id)}>{p.name}</button>
                <button className="v2-mono v2-muted" style={{ background: 'none', border: 0, cursor: 'pointer' }}
                  onClick={() => { if (confirm(`刪除「${p.name}」和他所有的練習紀錄？`)) { deleteProfile(p.id); setList(listProfiles()) } }}>刪除</button>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--color-divider)' }} />
          </div>
        )}

        <div className="v2-label" style={{ marginBottom: 6 }}>{list.length ? 'NEW 新增學生' : 'START 第一次使用'}</div>
        <div className="flex flex-col" style={{ gap: 10 }}>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={20} placeholder="名字或暱稱"
            onKeyDown={e => { if (e.key === 'Enter') add() }} className="v2-input" />
          <button className="v2-btn v2-btn-primary" style={{ width: '100%' }} disabled={!name.trim()} onClick={add}>開始</button>
        </div>
        <p className="v2-muted" style={{ fontSize: 11, marginTop: 14, lineHeight: 1.6 }}>紀錄存在這台裝置的瀏覽器裡；換裝置可到「學習進度」匯出備份。</p>

        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      </div>
    </div>
  )
}
