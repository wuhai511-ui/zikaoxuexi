import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { GitHubFlavoredMarkdown } from "@quartz-community/github-flavored-markdown"
import { toJsxRuntime } from "hast-util-to-jsx-runtime"
import { Fragment, jsx, jsxs } from "preact/jsx-runtime"
import renderToString from "preact-render-to-string"
import { BuildCtx } from "../util/ctx"
import { QuartzComponent, QuartzComponentProps } from "./types"
import { componentRegistry } from "./registry"
import { loadQuestions } from "./recall/content"
// @ts-ignore: Quartz bundles browser scripts as strings.
import script from "./scripts/recall.inline"

const ActiveRecall: QuartzComponent = ({ ctx, fileData }: QuartzComponentProps) => {
  if (!fileData.slug?.endsWith("今日背诵")) return null
  const processor = unified()
    .use(remarkParse)
    .use(GitHubFlavoredMarkdown({ enableSmartyPants: false }).markdownPlugins!({} as BuildCtx))
    .use(remarkRehype)
  const questions = loadQuestions(ctx.argv.directory).map((q) => {
    // Raw HTML is deliberately ignored by remark-rehype; Markdown tables remain readable.
    const answer = q.answer.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b ?? a)
    const tree = processor.runSync(processor.parse(answer))
    return { ...q, answerHtml: renderToString(toJsxRuntime(tree, { Fragment, jsx, jsxs })) }
  })
  return (
    <section id="active-recall" aria-label="主动背诵" data-questions={JSON.stringify(questions)}>
      <p>正在准备背诵卡…</p>
      <noscript>请启用 JavaScript 使用背诵卡。原始 Markdown 资料仍可阅读。</noscript>
    </section>
  )
}
ActiveRecall.afterDOMLoaded = script
componentRegistry.register("active-recall", () => ActiveRecall, "local:active-recall")
export default ActiveRecall
