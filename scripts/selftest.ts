// 自我測試：npm test
//  1. 題庫索引完整性（每張圖都存在、選項題答案在選項範圍內、題型都有題目）
//  2. 批改、選題分配、錯題本間隔複習、掌握度的行為

import fs from 'fs'
import path from 'path'
import { leafOf, leavesOf, progressOf, questionsByLeaf } from '../lib/bank'
import { levelOf, updateStat } from '../lib/mastery'
import { allocate } from '../lib/plan'
import { grade, lastAttempts, pickQuestions } from '../lib/practice'
import type { AttemptLog, Bank, BankQuestion, KPStat } from '../lib/types'
import { NEVER, dayStart, isDue, recordRight, recordWrong } from '../lib/wrongbook'

let fail = 0
const ok = (cond: unknown, msg: string) => { if (cond) console.log(`✓ ${msg}`); else { console.log(`✗ ${msg}`); fail++ } }

// ── 1. 題庫索引 ──
const ROOT = path.resolve(__dirname, '..')
const bank = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/bank/index.json'), 'utf8')) as Bank
ok(bank.chapters.length > 0 && bank.questions.length > 0, `題庫：${bank.chapters.length} 章、${bank.questions.length} 題`)
const missing = bank.questions.flatMap(q => [...q.img.q, ...(q.img.a ?? []), ...(q.img.s ?? [])]).filter(f => !fs.existsSync(path.join(ROOT, 'public', f)))
ok(missing.length === 0, `所有圖片都存在（缺 ${missing.length} 張${missing.length ? '：' + missing.slice(0, 3).join('、') : ''}）`)
ok(new Set(bank.questions.map(q => q.id)).size === bank.questions.length, '題目 id 不重複')
const badChoice = bank.questions.filter(q => q.kind === 'choice' && !(Array.isArray(q.answer) && q.answer.length && q.answer.every(a => a >= 1 && a <= (q.options ?? 0))))
ok(badChoice.length === 0, `選項題答案都在選項範圍內（不符 ${badChoice.length} 題）`)
const byLeaf = questionsByLeaf(bank)
const emptyLeaves = bank.chapters.flatMap(c => leavesOf(c)).filter(l => !byLeaf.get(l)?.length)
ok(emptyLeaves.length === 0, `每個題型都有可練的題目（空的：${emptyLeaves.join('、') || '無'}）`)
const noAns = bank.questions.filter(q => !q.img.a?.length && !q.img.s?.length)
ok(noAns.every(q => q.noAnswer), `沒有答案也沒有詳解的題目都標記 noAnswer、不出題（${noAns.map(q => q.id).join('、') || '無'}）`)

// ── 2. 批改 ──
const choice = { id: 'c', kind: 'choice', options: 5, answer: [1, 4, 5] } as BankQuestion
ok(grade(choice, [5, 1, 4]) === true, '多選：順序不同也算對')
ok(grade(choice, [1, 4]) === false, '多選：少選算錯')
ok(grade(choice, [1, 2, 4, 5]) === false, '多選：多選算錯')
ok(grade(choice, 'skip') === false, '不會＝答錯')
const tf = { id: 't', kind: 'tf', answer: false } as BankQuestion
ok(grade(tf, false) === true && grade(tf, true) === false, '是非題')
ok(grade({ id: 'o', kind: 'open' } as BankQuestion, 'self') === null, '計算題由學生自評')

// ── 3. 選題 ──
const strong: KPStat = { score: 92, attempts: 20, correct: 19, recent: [true, true, true, true, true], last: 1 }
const weak: KPStat = { score: 30, attempts: 10, correct: 3, recent: [false, false, true, false, false], last: 1 }
const alloc = allocate(10, [{ key: 's', available: 20, stat: strong }, { key: 'w', available: 20, stat: weak }, { key: 'n', available: 20 }])
ok((alloc.get('w') ?? 0) > (alloc.get('s') ?? 0) && (alloc.get('n') ?? 0) > (alloc.get('s') ?? 0), `弱的、沒練過的題型多出題（強 ${alloc.get('s')}、弱 ${alloc.get('w')}、新 ${alloc.get('n')}）`)
ok([...alloc.values()].reduce((a, b) => a + b, 0) === 10, '分配總數正確')
ok(allocate(10, [{ key: 'x', available: 3 }]).get('x') === 3, '不超過題庫題數')

const leaf = [...byLeaf.keys()].find(l => byLeaf.get(l)!.length >= 4)!
const qs = byLeaf.get(leaf)!
const logs: AttemptLog[] = [
  { qid: qs[0].id, leaf, correct: true, at: 1, ms: 1 },
  { qid: qs[1].id, leaf, correct: false, at: 2, ms: 1 },
]
const picked = pickQuestions([leaf], byLeaf, {}, lastAttempts(logs), qs.length)
ok(picked.slice(0, qs.length - 2).every(q => !logs.some(l => l.qid === q.id)), '沒做過的題目優先')
ok(picked[qs.length - 2]?.id === qs[1].id && picked[qs.length - 1]?.id === qs[0].id, '再來是做錯的，最後才是做對的')
const two = [...byLeaf.keys()].filter(l => byLeaf.get(l)!.length >= 5).slice(0, 2)
const mixed = pickQuestions(two, byLeaf, {}, new Map(), 6)
ok(mixed.every((q, i) => i === 0 || leafOf(q) !== leafOf(mixed[i - 1])), '不同題型交錯出題')

// ── 4. 錯題本 ──
const t0 = new Date(2026, 9, 18, 15).getTime()
let w = recordWrong(undefined, 'q1', [2], t0)
ok(w.box === 0 && !isDue(w, t0) && isDue(w, dayStart(t0, 1)), '答錯：隔天凌晨 4 點後到期')
ok(recordRight(w, t0).box === 0, '還沒到期就答對，不升盒')
let t = w.due
for (let i = 0; i < 5; i++) { w = recordRight(w, t); t = w.due }
ok(w.mastered && w.due === NEVER, '到期時連續答對 5 次＝已克服')
ok(JSON.parse(JSON.stringify(w)).due === NEVER, '已克服存進 JSON 後仍不會到期')
w = recordWrong(w, 'q1', 'skip', t0)
ok(w.box === 0 && !w.mastered && w.wrongCount === 2, '克服後又錯：重新複習、錯誤次數累加')

// ── 5. 掌握度 ──
let s: KPStat | undefined
for (let i = 0; i < 12; i++) s = updateStat(s, true, null, i)
ok(levelOf(s).key === 'good', `連續答對 12 題 → 已掌握（${s!.score}）`)
let s2: KPStat | undefined
for (let i = 0; i < 8; i++) s2 = updateStat(s2, false, null, i)
ok(levelOf(s2).key === 'weak', `連續答錯 → 待加強（${s2!.score}）`)
const p = progressOf([leaf], { [leaf]: s! }, byLeaf, new Set([qs[0].id]))
ok(p.total === qs.length && p.done === 1 && p.practicedLeaves === 1, '進度彙總')

console.log(fail ? `\n${fail} 項失敗` : '\n全部通過')
process.exit(fail ? 1 : 0)
