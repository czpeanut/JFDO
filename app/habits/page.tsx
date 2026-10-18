'use client'

// 學習習慣：從錯題量、作答速度、錯的題型推估學習習慣與模式，給出有研究依據的改善建議（lib/learning-profile.ts）
// 內容移植自 czpeanut/Self-learning-sys 的 /habits；版型同 student-app v2（統計格、左右雙欄、blueprint 框）

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Corners, Empty, Sect, Stat, pad2 } from '@/components/ui'
import { type Indicator, type LearningProfile, MIN_TOTAL, REFS, REF_MS } from '@/lib/learning-profile'
import { collectProfile } from '@/lib/profile-data'
import { type Prefs, getPrefs, setPrefs } from '@/lib/storage'
import { useBank } from '@/lib/use-bank'

const LEVEL = {
  good: { label: '良好', icon: '●', color: 'var(--color-accent-600)' },
  watch: { label: '留意', icon: '◐', color: 'var(--color-accent-700)' },
  concern: { label: '需要調整', icon: '▲', color: 'var(--color-accent-900)' },
  na: { label: '資料不足', icon: '○', color: 'rgba(29,31,32,.45)' },
}
const TONE_ICON = { good: '✓', watch: '◐', concern: '▲' }
const QUADRANTS = [
  // 上排正確率高、下排正確率低；左快右慢
  { id: 'fluent', label: '快又準確', sub: '流暢' }, { id: 'reflective', label: '慢而準確', sub: '沉思型' },
  { id: 'impulsive', label: '快但錯多', sub: '衝動型' }, { id: 'struggling', label: '慢且錯多', sub: '吃力' },
] as const

export default function HabitsPage() {
  const { bank } = useBank()
  const [p, setP] = useState<LearningProfile | null>(null)
  const [calmPref, setCalmPref] = useState<Prefs['calm']>('auto')
  useEffect(() => { if (bank) { setP(collectProfile(bank)); setCalmPref(getPrefs().calm) } }, [bank])
  if (!p) return <div style={{ padding: 24 }}><span className="v2-label">LOADING</span></div>

  const setCalm = (v: Prefs['calm']) => { setPrefs({ calm: v }); setCalmPref(v) }
  const count = (lv: keyof typeof LEVEL) => p.indicators.filter(i => i.level === lv).length

  return (
    <div className="v2-enter">
      <div className="v2-ctx">
        <span>從作答速度、錯題量與錯的題型，看出作答習慣，並給出有研究依據的改善方法</span>
        <span className="sep">|</span>
        <span>描述的是作答方式，不是能力的評價</span>
      </div>

      <div className="v2-stats cols-4">
        <Stat num={p.total} cap="作答紀錄 ANSWERS" sub={p.enough ? undefined : `至少 ${MIN_TOTAL} 題判斷才可靠`} />
        <Stat num={count('concern')} cap="需要調整 CONCERN" />
        <Stat num={count('watch')} cap="留意 WATCH" />
        <Stat num={count('good')} cap="良好 GOOD" />
      </div>

      {!p.enough && (
        <div className="v2-note" style={{ margin: '16px 22px 0' }}>
          目前有 {p.total} 題作答紀錄，至少 {MIN_TOTAL} 題後判斷才比較可靠；下方先列出資料已足夠的部分。
          <Link href="/" className="v2-link" style={{ marginLeft: 8 }}>去練習 →</Link>
        </div>
      )}

      <div className="v2-2col">
        <div>
          {/* 模式 */}
          <Sect label="PATTERNS" title="作答模式" />
          {p.patterns.length === 0 ? <Empty>還看不出明顯的作答模式，多練一些再回來看。</Empty> : (
            <div className="flex flex-col" style={{ gap: 14, padding: '4px 22px 6px' }}>
              {p.patterns.map(x => (
                <div key={x.id} className="blueprint" style={{ padding: '14px 16px', background: x.tone === 'concern' ? 'var(--color-accent-100)' : undefined }}>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 19, fontWeight: 600 }}>{TONE_ICON[x.tone]} {x.name}</div>
                  <p className="v2-muted" style={{ fontSize: 13, marginTop: 4, lineHeight: 1.65 }}>{x.desc}</p>
                  <Corners />
                </div>
              ))}
            </div>
          )}

          {/* 建議 */}
          {p.advice.length > 0 && (
            <>
              <Sect label="ADVICE" title="改善建議（依重要性）" />
              {p.advice.map((a, i) => (
                <div key={a.id} className="flex" style={{ gap: 12, padding: '14px 22px', borderTop: '1px solid var(--color-divider)' }}>
                  <span className="v2-idx" style={{ paddingTop: 3 }}>{pad2(i + 1)}</span>
                  <div className="min-w-0">
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: 17, fontWeight: 600 }}>{a.title}</div>
                    <div className="v2-muted" style={{ fontSize: 13, marginTop: 2 }}>{a.why}</div>
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>{a.how.map((h, j) => <li key={j}>{h}</li>)}</ul>
                    <div className="v2-mono v2-muted" style={{ marginTop: 6, fontSize: 10 }}>研究依據：{REFS[a.ref].short}</div>
                  </div>
                </div>
              ))}
              <div style={{ borderBottom: '1px solid var(--color-divider)' }} />
              <details style={{ padding: '12px 22px', fontSize: 13 }}>
                <summary className="v2-link" style={{ cursor: 'pointer' }}>給家長的話</summary>
                <p className="v2-muted" style={{ fontSize: 11, margin: '8px 0 4px' }}>描述的是作答方式，不排名、不貼標籤；習慣都可以調整。</p>
                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>{p.advice.map(a => <li key={a.id}>{a.parent}</li>)}</ul>
              </details>
            </>
          )}
        </div>

        <div>
          <TempoChart p={p} />

          {/* 冷靜作答設定 */}
          <Sect label="CALM MODE" title="冷靜作答"
            sub={<>送出答案前顯示檢查口訣、題目出現 5 秒後才能送出。{calmPref === 'auto' && (p.calmMode ? '（偵測到快而錯多，目前已自動開啟）' : '（目前沒有偵測到衝動型作答，未開啟）')}</>} />
          <div className="flex" style={{ gap: 6, padding: '0 22px 16px' }}>
            {(['auto', 'on', 'off'] as const).map(v => (
              <button key={v} onClick={() => setCalm(v)} className={`v2-tag${calmPref === v ? ' is-on' : ''}`}>{{ auto: '自動', on: '開啟', off: '關閉' }[v]}</button>
            ))}
          </div>

          {/* 指標 */}
          <Sect label="INDICATORS" title="各項指標" sub="每項只在資料量足夠時才判斷；點「研究依據」看出處" />
          {p.indicators.map(i => <IndicatorRow key={i.id} i={i} />)}
          <div style={{ borderBottom: '1px solid var(--color-divider)' }} />
          <p className="v2-muted" style={{ padding: '12px 22px', fontSize: 11, lineHeight: 1.6 }}>
            參考作答時間：是非題 {REF_MS.tf / 1000} 秒、選項題 {REF_MS.choice / 1000} 秒、計算填充題 {REF_MS.open / 1000} 秒（估計值，之後會用實際作答時間校正）。研究整理與門檻見 docs/LEARNING-PROFILE.md。
          </p>
        </div>
      </div>
    </div>
  )
}

function IndicatorRow({ i }: { i: Indicator }) {
  const l = LEVEL[i.level]
  return (
    <div style={{ padding: '11px 22px', borderTop: '1px solid var(--color-divider)', fontSize: 13 }}>
      <div className="flex items-start justify-between" style={{ gap: 8 }}>
        <span style={{ fontWeight: 600 }}>{i.title}</span>
        <span className="v2-mono" style={{ color: l.color, fontWeight: i.level === 'concern' ? 600 : 400, whiteSpace: 'nowrap' }}>{l.icon} {l.label}</span>
      </div>
      <div style={{ marginTop: 2 }}>{i.display}</div>
      <div className="v2-muted" style={{ fontSize: 11, marginTop: 2 }}>{i.evidence}</div>
      <details style={{ marginTop: 4, fontSize: 11 }}>
        <summary className="v2-link" style={{ cursor: 'pointer', fontSize: 11 }}>研究依據</summary>
        <div className="v2-muted" style={{ marginTop: 4, lineHeight: 1.6 }}>{REFS[i.ref].full}</div>
      </details>
    </div>
  )
}

/** 作答節奏四象限（Kagan）：橫軸速度、縱軸正確率，標出學生目前的位置 */
function TempoChart({ p }: { p: LearningProfile }) {
  const t = p.tempo
  // 速度：參考時間倍數 0.25–2（對數）→ 0–100%；左快右慢
  const x = t.relSpeed == null ? null : Math.min(100, Math.max(0, ((Math.log2(t.relSpeed) + 2) / 3) * 100))
  const y = t.accuracy == null ? null : Math.min(100, Math.max(0, (1 - t.accuracy) * 100))
  return (
    <div>
      <Sect label="TEMPO" title="作答節奏" sub="Kagan 沉思型／衝動型四象限" />
      <div style={{ padding: '0 22px 18px' }}>
        <div className="relative w-full" style={{ aspectRatio: '1 / 1', maxWidth: 360 }}>
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2" style={{ gap: 1, background: 'var(--color-divider)', border: '1px solid var(--color-divider)' }}>
            {QUADRANTS.map(qd => (
              <div key={qd.id} className="flex flex-col items-center justify-center text-center" style={{ background: t.quadrant === qd.id ? 'var(--color-accent-100)' : 'var(--color-bg)' }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{qd.label}</div>
                <div className="v2-mono v2-muted" style={{ fontSize: 10 }}>{qd.sub}</div>
              </div>
            ))}
          </div>
          {x != null && y != null && (
            <div className="absolute" title={`速度 ${t.relSpeed!.toFixed(2)} 倍參考時間、正確率 ${Math.round(t.accuracy! * 100)}%`}
              style={{ left: `${x}%`, top: `${y}%`, width: 14, height: 14, transform: 'translate(-50%,-50%)', background: 'var(--color-accent)', outline: '2px solid #fff' }} />
          )}
        </div>
        <div className="v2-mono v2-muted flex justify-between" style={{ marginTop: 4, fontSize: 10, maxWidth: 360 }}><span>← 快</span><span>慢 →</span></div>
        <div className="v2-muted" style={{ marginTop: 4, fontSize: 12 }}>
          {t.relSpeed == null ? '資料不足（需要 20 題以上）' : `作答時間約參考時間的 ${t.relSpeed.toFixed(2)} 倍、正確率 ${Math.round(t.accuracy! * 100)}%（上＝正確率高）`}
        </div>
      </div>
    </div>
  )
}
