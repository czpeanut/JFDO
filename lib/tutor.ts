// 問 AI：題庫已附詳解，AI 的角色是「針對學生卡住的那一步再講一次」。
// 題目、答案、詳解都是 PDF 裁下的圖（數學式保真），連同圖片一起送給 Gemini（多模態）。
// 風格沿用 student-app 詳解：白話、簡短、公式用 $...$；幾何題可附 ```figure``` 圖（由 SolutionView 畫出）。

/** 預設與 student-app 詳解相同的模型 */
export const TUTOR_MODEL = process.env.GEMINI_SOLVE_MODEL?.trim() || 'gemini-3.7-flash'

export const QUICK_DOUBTS = ['詳解的第一步是怎麼想到的？', '中間那步是怎麼算出來的？', '可以換一個更簡單的講法嗎？', '這題用到什麼觀念／公式？']

export function buildTutorPrompt(input: { where: string; history: { q: string; a: string }[]; doubt: string; hasSolution: boolean }): string {
  const past = input.history.map((h, i) => `學生第 ${i + 1} 次問：${h.q}\n你的回答：${h.a}`).join('\n\n')
  return `你是台灣高中數學家教，學生正在練習題庫（${input.where}）。
附圖依序是：題目${input.hasSolution ? '、答案、題庫附的詳解' : ''}。圖中的數學式以圖為準。
${past ? `\n先前的問答：\n${past}\n` : ''}
學生現在問：「${input.doubt}」

請針對學生「卡住的那一點」解釋：
- 先用一句話點出他可能卡住的原因。
- 再用更小的步驟說明${input.hasSolution ? '詳解裡的關鍵那一步，不要把整份詳解重講一次' : '解題的關鍵步驟'}；必要時換一個簡單的數字例子。
- 只用高中數學課內、本章（含）之前教過的方法，用學生聽得懂的白話，不要學術腔。
- 250 字以內（不含公式），數學式一律用 $...$ 包住。
- 最後用一個「確認理解的小問題」結尾（不要附答案）。
- 若畫圖有幫助（幾何、數線、坐標），可以附一個圖形區塊：三個反引號加 figure，區塊內只放 JSON（points 必填：[{"name":"A","x":0,"y":0}]，可選 segments、circles、angles、rightAngles、segLabels）；其他題不要畫。
- 如果學生的問題與本題無關，禮貌地請他專注在這一題。
直接輸出內容，不要前言。`
}
