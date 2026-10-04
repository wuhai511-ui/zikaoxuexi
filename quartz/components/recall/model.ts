export type Mastery = "known" | "fuzzy" | "unknown"
export interface Progress {
  questionId: string
  masteryStatus: Mastery
  reviewCount: number
  lastReviewedAt: string
  nextReviewAt: string
}
export interface Question {
  questionId: string
  knowledgePointId: string
  sourceNumber: number
  title: string
  chapter: string
  keywords: string
  points: string[]
  answerHtml?: string
  answer: string
  tags: string[]
  exams: string[]
  overlap?: string
}
export const STORAGE_KEY = "zikaoxuexi:00178:recall:v1"
export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}
export function review(
  questionId: string,
  status: Mastery,
  previous?: Progress,
  now = new Date(),
): Progress {
  const count = (previous?.reviewCount ?? 0) + 1
  const days =
    status === "unknown"
      ? 1
      : status === "fuzzy"
        ? 2
        : previous?.masteryStatus === "known"
          ? Math.min(30, 3 * 2 ** Math.min(count - 1, 4))
          : 3
  const next = new Date(now)
  next.setDate(next.getDate() + days)
  return {
    questionId,
    masteryStatus: status,
    reviewCount: count,
    lastReviewedAt: now.toISOString(),
    nextReviewAt: next.toISOString(),
  }
}
export function parseProgress(raw: string | null): Record<string, Progress> {
  if (!raw) return {}
  const data = JSON.parse(raw)
  if (data.version !== 1 || !data.questions || typeof data.questions !== "object")
    throw new Error("不支持的学习记录格式")
  const result: Record<string, Progress> = {}
  for (const [id, value] of Object.entries(data.questions)) {
    const p = value as Progress
    if (
      p &&
      p.questionId === id &&
      ["known", "fuzzy", "unknown"].includes(p.masteryStatus) &&
      Number.isInteger(p.reviewCount) &&
      p.reviewCount > 0 &&
      Number.isFinite(Date.parse(p.lastReviewedAt)) &&
      Number.isFinite(Date.parse(p.nextReviewAt))
    )
      result[id] = p
    else throw new Error("学习记录损坏")
  }
  return result
}
export function priority(p?: Progress, now = new Date()): number {
  if (p?.masteryStatus === "unknown") return 0
  if (p?.masteryStatus === "fuzzy") return 1
  if (p && Date.parse(p.nextReviewAt) <= now.getTime()) return 2
  return p ? 4 : 3
}
export function plain(text: string): string {
  return text
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b ?? a)
    .replace(/\*\*/g, "")
    .trim()
}
