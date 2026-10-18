// STATIC_EXPORT=1：輸出靜態網頁給 GitHub Pages（.github/workflows/pages.yml；建置前會移除 API 與 middleware）
const staticExport = process.env.STATIC_EXPORT === '1'

/** @type {import('next').NextConfig} */
const nextConfig = staticExport
  ? { output: 'export', basePath: process.env.NEXT_PUBLIC_BASE_PATH || '', trailingSlash: true }
  : {
      // 問 AI 會在伺服器端讀題庫索引與圖片，部署時要一起打包進 API 函式
      outputFileTracingIncludes: { '/api/ask': ['./public/bank/**/*'] },
    }

export default nextConfig
