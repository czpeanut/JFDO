'use client'

// 裝置帳號：同一台平板／電腦可以有好幾位學生，每位的進度、錯題分開存（本機 localStorage）。

import { useEffect, useState } from 'react'
import { createProfile, currentProfile, deleteProfile, listProfiles, switchProfile, type Profile } from '@/lib/storage'

export default function ProfileGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [me, setMe] = useState<Profile | null>(null)
  const [list, setList] = useState<Profile[]>([])
  const [name, setName] = useState('')

  useEffect(() => { setMe(currentProfile()); setList(listProfiles()); setReady(true) }, [])

  if (!ready) return null
  if (me) return <>{children}</>

  const pick = (id: string) => { switchProfile(id); setMe(currentProfile()) }
  const add = () => { if (name.trim()) { createProfile(name); setMe(currentProfile()) } }

  return (
    <div className="mx-auto mt-10 max-w-sm space-y-5 px-4">
      <div className="text-center">
        <div className="text-5xl">📚</div>
        <h1 className="mt-2 text-xl font-bold">JFDO 題庫練習</h1>
        <p className="mt-1 text-sm text-ink-soft">國中段考題庫・知識點進度・錯題本・AI 詳解</p>
      </div>
      {list.length > 0 && (
        <div className="card divide-y divide-black/5">
          <div className="px-4 py-2 text-xs font-medium text-ink-soft">選擇學生</div>
          {list.map(p => (
            <div key={p.id} className="flex items-center gap-2 px-4 py-2.5">
              <button className="flex-1 text-left font-medium hover:text-brand-600" onClick={() => pick(p.id)}>👤 {p.name}</button>
              <button className="text-xs text-ink-muted hover:text-red-600"
                onClick={() => { if (confirm(`刪除「${p.name}」和他所有的練習紀錄？`)) { deleteProfile(p.id); setList(listProfiles()) } }}>刪除</button>
            </div>
          ))}
        </div>
      )}
      <div className="card space-y-3 p-4">
        <div className="text-sm font-medium">{list.length ? '新增學生' : '第一次使用，輸入你的名字'}</div>
        <input value={name} onChange={e => setName(e.target.value)} maxLength={20} placeholder="名字或暱稱"
          onKeyDown={e => { if (e.key === 'Enter') add() }}
          className="w-full rounded-xl border border-black/10 px-3 py-2 outline-none focus:border-brand-500" />
        <button className="btn-primary w-full" disabled={!name.trim()} onClick={add}>開始</button>
        <p className="text-xs text-ink-muted">紀錄存在這台裝置的瀏覽器裡；換裝置可到「學習進度」匯出備份。</p>
      </div>
    </div>
  )
}
