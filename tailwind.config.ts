import type { Config } from 'tailwindcss'

// 顏色、字型、元件樣式都在 app/industry.css（student-app v2 的設計系統）；Tailwind 只用來排版（flex、grid、間距）
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
export default config
