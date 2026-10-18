/* eslint-disable @next/next/no-img-element */
// 題目／答案／詳解圖（從 PDF 原樣裁下，數學式保真；跨頁的題目有好幾張）。
// 圖以 144 dpi 裁切，宣告成 1.5 倍密度顯示：每張圖的字一樣大（約 16px），超出畫面寬度才等比縮小，手機可雙指放大。

export default function QImages({ srcs, alt, className = '' }: { srcs: string[] | undefined; alt: string; className?: string }) {
  if (!srcs?.length) return null
  return (
    <div className={`space-y-1 ${className}`}>
      {srcs.map((s, i) => (
        <img key={s} srcSet={`${encodeURI(s)} 1.5x`} src={encodeURI(s)} alt={srcs.length > 1 ? `${alt}（${i + 1}/${srcs.length}）` : alt}
          className="block h-auto max-w-full select-none" loading="lazy" draggable={false} />
      ))}
    </div>
  )
}
