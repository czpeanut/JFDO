/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // 問 AI 會在伺服器端讀題庫索引與圖片，部署時要一起打包進 API 函式
    outputFileTracingIncludes: { '/api/ask': ['./public/bank/**/*'] },
  },
}

export default nextConfig
