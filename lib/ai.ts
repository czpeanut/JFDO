const clean = (s?: string) => (s ?? '').replace(/[﻿​-‍ ]/g, '').trim()

export const hasGemini = () => clean(process.env.GEMINI_API_KEY).length > 0
