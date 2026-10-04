import { plain, Question } from "./model"
// Source numbers are permanent legacy identities: never renumber existing entries.
const circled = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚㉛㉜㉝㉞㉟㊱㊲㊳㊴㊵㊶㊷㊸㊹㊺㊻㊼㊽㊾㊿"
const groups: Record<number, [number, string]> = {
  65: [18, "观察类型重合，补录包含扩展类型"],
  66: [29, "与29共用抽样程序：界定总体至选择样本；原差异已作口径说明"],
  67: [38, "与38共用基本程序；统计方法类型不替代第一步“明确目的”"],
  74: [12, "与12共用教材五项促销内容；人员推销等作扩展解释"],
  69: [5, "调查计划书与调查方案高度重合"],
}
const supplementChapters: Record<number, string> = {
  58: "ch04",
  59: "ch04",
  60: "ch01",
  61: "ch01",
  62: "ch04",
  63: "ch05",
  64: "ch06",
  65: "ch04",
  66: "ch06",
  67: "ch08",
  68: "ch10",
  69: "ch02",
  70: "ch03",
  71: "ch05",
  72: "ch07",
  73: "ch01",
  74: "ch03",
  76: "ch08",
  77: "ch04",
}
const bundles: Record<number, { titles: string[]; chapters: string[]; knowledge: number[] }> = {
  75: {
    titles: [
      "调查人员素质",
      "调查/预测/决策关系",
      "二手资料优缺点",
      "营销因素调查 4P",
      "调查与预测作用",
      "问卷具体内容确定",
    ],
    chapters: ["ch07", "ch01–ch02", "ch04", "ch03", "ch01–ch02", "ch05"],
    knowledge: [7501, 6, 13, 7504, 2, 7506],
  },
  78: {
    titles: ["定性预测与定量预测的区别及各自特点", "什么情况下适合使用抽样调查", "四类调查的区别"],
    chapters: ["ch09", "ch06", "ch01–ch02"],
    knowledge: [7801, 64, 7],
  },
}
export function parseQuestions(markdown: string): Question[] {
  const matches = [...markdown.matchAll(/^\*\*([①-⑳㉑-㉟㊱-㊿]|\((\d+)\))\s+(.+?)\*\*/gm)]
  const questions: Question[] = []
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i],
      number = m[2] ? Number(m[2]) : circled.indexOf(m[1]) + 1
    const end = matches[i + 1]?.index ?? markdown.indexOf("## 背诵计划建议", m.index)
    const block = markdown
      .slice(m.index! + m[0].length, end < 0 ? undefined : end)
      .split(/\n(?:## |---)/)[0]
      .replace(/^\s*——\s*/, "")
      .trim()
    const heading =
      [...markdown.slice(0, m.index).matchAll(/^## (ch[^\n]+)/gm)].at(-1)?.[1] ?? "章节待核对"
    const chapter = number > 57 ? (supplementChapters[number] ?? "跨章节") : heading
    const bundle = bundles[number]
    const chunks = bundle ? block.split(/[①②③④⑤⑥]/).slice(1, bundle.titles.length + 1) : [block]
    chunks.forEach((answer, j) => {
      const id = `00178-q${String(number).padStart(3, "0")}${bundle ? `-${j + 1}` : ""}`
      const kp = bundle ? bundle.knowledge[j] : (groups[number]?.[0] ?? number)
      const mnemonic = answer.match(/「([^」]+)」/)?.[1]
      const points = extractPoints(answer)
      const exams = [...new Set(answer.match(/20\d{2}[-–]\d{2}/g) ?? [])]
      questions.push({
        questionId: id,
        knowledgePointId: `00178-kp${String(kp).padStart(3, "0")}`,
        sourceNumber: number,
        title: bundle?.titles[j] ?? plain(m[3]),
        chapter: bundle?.chapters[j] ?? chapter,
        keywords: plain(mnemonic ?? points.slice(0, 3).join(" · ")),
        points,
        answer: answer.trim(),
        tags: [
          "必背",
          ...(exams.length >= 2 || /最高频|高频|重考|2 次|★/.test(answer + m[3]) ? ["高频"] : []),
          ...(/陷阱|辨析|区别|待核实|不是|不同|不可/.test(answer + m[3]) ? ["易错"] : []),
        ],
        exams,
        overlap:
          groups[number]?.[1] ?? (bundle && kp < 100 ? "与既有考点重合；保留论述变体" : undefined),
      })
    })
  }
  if (
    matches.length !== 78 ||
    questions.length !== 85 ||
    new Set(questions.map((q) => q.questionId)).size !== 85
  )
    throw new Error("背诵题库结构变化，请检查稳定 ID 映射")
  return questions
}

// Mnemonics and exam references are hints, never stand-alone scoring points.
export function extractPoints(answer: string): string[] {
  const body = answer
    .replace(/(?:口诀|记忆提示|背诵提示|记忆)\s*[：:]?\s*「[^」]*」[。；]?/g, "")
    .replace(/「[^」]*」/g, "")
    .replace(/（[^（）]*20\d{2}[^（）]*）/g, "")
  const bold = [...body.matchAll(/\*\*(.+?)\*\*/gs)].map((x) => plain(x[1]))
  const segments = plain(body)
    .split(/\n|[①②③④⑤⑥⑦⑧⑨⑩]|\s*→\s*|\s*\+\s*|[；;]/)
    .map((x) => x.trim())
    .filter(Boolean)
  return bold.length ? bold : segments
}
