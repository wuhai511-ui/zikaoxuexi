import fs from "node:fs"
import path from "node:path"
import { Question, plain } from "./model"
import { parseQuestions } from "./parser"

export type AnswerOverride = Partial<Pick<Question, "keywords" | "points" | "answer">>
export function applyOverrides(questions: Question[], overrides: Record<string, AnswerOverride>) {
  for (const [id, patch] of Object.entries(overrides)) {
    const q = questions.find((q) => q.questionId === id)
    if (!q) throw new Error(`未知 questionId: ${id}`)
    if (
      (patch.keywords !== undefined && typeof patch.keywords !== "string") ||
      (patch.answer !== undefined && typeof patch.answer !== "string") ||
      (patch.points !== undefined &&
        (!Array.isArray(patch.points) || patch.points.some((p) => typeof p !== "string")))
    )
      throw new Error(`答案格式错误: ${id}`)
    for (const key of Object.keys(patch))
      if (!["keywords", "points", "answer"].includes(key))
        throw new Error(`不允许覆盖稳定身份: ${id}.${key}`)
  }
  return questions.map((q) => ({ ...q, ...overrides[q.questionId] }))
}
export function loadQuestions(directory: string): Question[] {
  const base = path.join(directory, "00178-市场调查与预测")
  let questions = parseQuestions(
    fs.readFileSync(path.join(base, "04-背诵手册/简答论述必背.md"), "utf8"),
  )
  const essays = fs.readFileSync(path.join(base, "03-重难点专题/论述题-高频TOP10.md"), "utf8")
  // Expand the six bundled essays from their existing Markdown frameworks.
  questions = questions.map((q) => {
    if (q.sourceNumber !== 75) return q
    const n = Number(q.questionId.split("-").at(-1))
    const section = essays
      .match(new RegExp(`### 补 ${n}\\.[^\\n]*\\n([\\s\\S]*?)(?=\\n### |\\n> \\*\\*合并后|$)`))?.[1]
      ?.trim()
    if (!section) throw new Error(`论述框架缺失: ${q.questionId}`)
    return expand(q, section)
  })
  // The original bundle mislabels 2022-04 as Q38; actual source uses Q36.
  const exams = ["2021-10", "2022-04", "2024-10"]
  questions = questions.map((q) => {
    if (q.sourceNumber !== 78) return q
    const n = Number(q.questionId.split("-").at(-1)) - 1
    const source = fs.readFileSync(path.join(base, `02-历年真题/${exams[n]}.md`), "utf8")
    const number = n === 1 ? 36 : 38
    const section = source
      .match(new RegExp(`\\*\\*${number}\\.[^\\n]+\\n([\\s\\S]*?)(?=\\n## |\\n---|$)`))?.[1]
      ?.trim()
    if (!section) throw new Error(`真题论述答案缺失: ${q.questionId}`)
    return expand(q, section)
  })
  const overridePath = path.join(base, "04-背诵手册/active-recall.overrides.json")
  return applyOverrides(
    questions,
    fs.existsSync(overridePath) ? JSON.parse(fs.readFileSync(overridePath, "utf8")) : {},
  )
}
function expand(q: Question, answer: string): Question {
  const points = plain(answer)
    .split(/\n|[①②③④⑤⑥]/)
    .map((x) => x.trim())
    .filter((x) => x && !x.startsWith("【考点") && !x.startsWith("|---"))
  return {
    ...q,
    answer,
    points,
    keywords: plain(answer.match(/「([^」]+)」/)?.[1] ?? points.slice(0, 3).join(" · ")),
  }
}
