import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import { parseQuestions } from "./parser"
import { localDay, parseProgress, priority, review } from "./model"
const source = fs.readFileSync("content/00178-市场调查与预测/04-背诵手册/简答论述必背.md", "utf8")
test("78 legacy entries become 85 stable variants, with shared knowledge identities", () => {
  const q = parseQuestions(source)
  assert.equal(q.length, 85)
  assert.equal(q.filter((x) => x.sourceNumber <= 57).length, 57)
  assert.equal(new Set(q.map((x) => x.knowledgePointId)).size, 75)
  for (const [a, b] of [
    [29, 66],
    [18, 65],
    [38, 67],
    [12, 74],
  ]) {
    assert.equal(
      q.find((x) => x.sourceNumber === a)!.knowledgePointId,
      q.find((x) => x.sourceNumber === b)!.knowledgePointId,
    )
    assert.notEqual(
      q.find((x) => x.sourceNumber === a)!.answer,
      q.find((x) => x.sourceNumber === b)!.answer,
    )
  }
  assert.equal(q.filter((x) => x.sourceNumber === 75).length, 6)
  assert.equal(q.filter((x) => x.sourceNumber === 78).length, 3)
  assert.equal(
    parseQuestions(source.replace("信息的特征", "信息的基本特征"))[0].questionId,
    q[0].questionId,
  )
  const reordered = parseQuestions(
    source.replace("**① 信息", "**② 信息").replace("**② 市场调查", "**① 市场调查"),
  )
  assert.equal(reordered[0].questionId, "00178-q002")
  assert.ok(q[6].answer.includes("| 类型 |"))
  assert.ok(q[13].answer.includes("| 方法 |"))
  assert.ok(q.every((x) => !x.answer.includes("背诵计划建议")))
})
test("review persistence round trips and schedules all mastery states", () => {
  const now = new Date("2026-10-04T12:00:00Z")
  for (const [status, days] of [
    ["unknown", 1],
    ["fuzzy", 2],
    ["known", 3],
  ] as const) {
    const p = review("q1", status, undefined, now)
    assert.equal(p.reviewCount, 1)
    assert.equal((Date.parse(p.nextReviewAt) - now.getTime()) / 86400000, days)
    assert.deepEqual(parseProgress(JSON.stringify({ version: 1, questions: { q1: p } })), { q1: p })
  }
  const p = review("q1", "known", undefined, now)
  const twice = review("q1", "known", p, now)
  assert.equal(twice.reviewCount, 2)
  assert.equal((Date.parse(twice.nextReviewAt) - now.getTime()) / 86400000, 6)
  assert.equal(review("q1", "unknown", twice, now).masteryStatus, "unknown")
})
test("unknown > fuzzy > due > new; future known is excluded from daily queue", () => {
  const now = new Date("2026-10-04T12:00:00Z")
  const p = review("q1", "known", undefined, now)
  assert.equal(priority({ ...p, masteryStatus: "unknown" }, now), 0)
  assert.equal(priority({ ...p, masteryStatus: "fuzzy" }, now), 1)
  assert.equal(priority({ ...p, nextReviewAt: now.toISOString() }, now), 2)
  assert.equal(priority(undefined, now), 3)
  assert.equal(priority(p, now), 4)
  assert.equal(localDay(new Date(2026, 9, 4, 23, 59)), "2026-10-04")
})
test("corrupt and unknown-version storage cannot silently overwrite progress", () => {
  assert.deepEqual(parseProgress(null), {})
  assert.throws(() => parseProgress("{"))
  assert.throws(() => parseProgress('{"version":2,"questions":{}}'))
  assert.throws(() => parseProgress('{"version":1,"questions":{"q1":{"questionId":"q1"}}}'))
})

import { applyOverrides, loadQuestions } from "./content"
test("bundled essays load existing frameworks and gradual overrides keep identities", () => {
  const q = loadQuestions("content")
  assert.ok(q.find((x) => x.questionId === "00178-q075-1")!.answer.includes("业务能力"))
  assert.ok(q.find((x) => x.questionId === "00178-q078-2")!.answer.includes("破坏性"))
  assert.ok(q.find((x) => x.questionId === "00178-q078-3")!.answer.includes("资料来源"))
  const updated = applyOverrides(q, {
    "00178-q001": { keywords: "人工核对关键词", points: ["采分点"], answer: "校订答案" },
  })
  assert.equal(updated[0].questionId, q[0].questionId)
  assert.equal(updated[0].keywords, "人工核对关键词")
  assert.throws(() => applyOverrides(q, { missing: { answer: "x" } }))
  assert.throws(() => applyOverrides(q, { "00178-q001": { questionId: "x" } as any }))
})

import { extractPoints } from "./parser"
test("mnemonics are excluded from automatic scoring-point extraction", () => {
  const points = extractPoints(
    "界定总体 → 定框架 → 定单位 → 选方法 → 定容量 → 选择样本。口诀「**总架位法量选**」（2019-04 简32）",
  )
  assert.equal(points.length, 6)
  assert.ok(points[0].includes("界定总体"))
  assert.ok(points[5].includes("选择样本"))
  assert.ok(points.every((p) => !p.includes("总架位法量选") && !p.includes("2019-04")))
  assert.deepEqual(extractPoints("**市场印象**＋**传播方式**。口诀「**印传**」"), [
    "市场印象",
    "传播方式",
  ])
})
test("all 85 cards have curated outlines, sources and unchanged legacy identities", () => {
  const questions = loadQuestions("content")
  assert.equal(questions.length, 85)
  assert.equal(new Set(questions.map((q) => q.knowledgePointId)).size, 75)
  assert.ok(
    questions.every(
      (q) =>
        q.curated &&
        q.sources?.length &&
        q.verificationNote &&
        q.keywords.length <= 50 &&
        q.points.length >= 3,
    ),
  )
  assert.equal(questions.filter((q) => q.curatedAnswer).length, 40)
  for (const q of questions.filter(
    (q) => (q.sourceNumber >= 58 && q.sourceNumber <= 74) || q.sourceNumber === 76,
  )) {
    assert.ok(q.points.length >= 4, q.questionId)
    assert.ok(
      q.points.every((p) => p !== q.keywords),
      q.questionId,
    )
  }
  const byId = (id: string) => questions.find((q) => q.questionId === id)!
  assert.equal(byId("00178-q029").knowledgePointId, byId("00178-q066").knowledgePointId)
  assert.ok(byId("00178-q029").points.at(-1)!.startsWith("选择样本"))
  assert.ok(byId("00178-q066").points.at(-1)!.startsWith("选择样本"))
  assert.ok(byId("00178-q038").points[0].startsWith("明确"))
  assert.ok(byId("00178-q067").points[0].startsWith("明确"))
  assert.ok(byId("00178-q009").points.some((p) => p.startsWith("自然")))
  assert.deepEqual(byId("00178-q012").points.slice(0, 4), byId("00178-q074").points.slice(0, 4))
  assert.ok(byId("00178-q025").answer.includes("狭义"))
  assert.ok(byId("00178-q025").answer.includes("广义"))
  assert.ok(byId("00178-q078-3").verificationNote!.includes("附表为空白"))
})
test("PDF-confirmed 2022-04 numbering and answer-source lookup stay aligned", () => {
  const source = fs.readFileSync("content/00178-市场调查与预测/02-历年真题/2022-04.md", "utf8")
  assert.match(source, /\*\*36\.\*\* 某地有居民 400000/)
  assert.match(source, /\*\*37\.\*\* 某村连续/)
  assert.match(source, /\*\*38\. 请结合实际论述什么情况下适合使用抽样调查/)
  assert.ok(source.indexOf("**37.**") < source.indexOf("**38. 请"))
  assert.ok(
    loadQuestions("content")
      .find((q) => q.questionId === "00178-q078-2")!
      .sources!.some((s) => s.includes("2022-04.md，论述38")),
  )
})
test("source metadata and nonempty curated answers are validated", () => {
  const questions = loadQuestions("content")
  for (const patch of [
    { points: [] },
    { keywords: " " },
    { answer: "" },
    { sources: [42] },
    { sources: [] },
    { verificationNote: 42 },
    null,
  ]) {
    assert.throws(() => applyOverrides(questions, { "00178-q001": patch as any }))
  }
  assert.throws(() =>
    applyOverrides(questions, { "00178-q001": { knowledgePointId: "changed" } as any }),
  )
  const edited = applyOverrides(questions, {
    "00178-q001": { sources: ["source"], verificationNote: "note" },
  })
  assert.deepEqual(edited[0].sources, ["source"])
  assert.equal(edited[0].questionId, questions[0].questionId)
})
