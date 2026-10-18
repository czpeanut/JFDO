'use client'

// LaTeX 渲染（KaTeX）：答案式、選填格式
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { useMemo } from 'react'

export default function TeX({ tex, block = false, className }: { tex: string; block?: boolean; className?: string }) {
  const html = useMemo(() => katex.renderToString(tex, { throwOnError: false, displayMode: block, strict: 'ignore' }), [tex, block])
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
}

/** 把選填式裡的編號格換成學生填的字（沒填的保留編號） */
export function filledTex(tex: string, filled: (string | undefined)[]): string {
  return tex.replace(/\\boxed\{\\scriptstyle (\d+)\}/g, (_m, n: string) => {
    const c = filled[Number(n) - 1]
    return c ? `\\boxed{${c === '-' ? '-' : c}}` : `\\boxed{\\scriptstyle ${n}}`
  })
}
