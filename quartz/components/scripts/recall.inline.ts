import {
  localDay,
  parseProgress,
  plain,
  priority,
  Question,
  Progress,
  Mastery,
  review,
  STORAGE_KEY,
} from "../recall/model"

function initRecall() {
  const root = document.getElementById("active-recall")
  if (!root || root.dataset.ready) return
  root.dataset.ready = "true"
  const questions: Question[] = JSON.parse(root.dataset.questions!)
  let progress: Record<string, Progress> = {}
  let storageError = ""
  let blocked = false
  let filter = "今日背诵"
  let index = 0
  let level = 0
  let scroll = 0
  let resumeId = ""
  const sessionKey = `${STORAGE_KEY}:view`
  try {
    progress = parseProgress(localStorage.getItem(STORAGE_KEY))
  } catch {
    storageError = "无法读取学习记录。原记录已保留，请检查浏览器存储；本次暂不能保存。"
    blocked = true
  }
  try {
    const view = JSON.parse(sessionStorage.getItem(sessionKey) ?? "null")
    if (view) {
      filter = view.filter
      index = view.index
      scroll = view.scroll ?? 0
      resumeId = view.questionId ?? ""
    }
  } catch {
    /* A missing session does not affect saved mastery. */
  }
  let queue: Question[] = []
  const filters = [
    "今日背诵",
    "今日新背",
    "今日到期复习",
    "全部",
    "必背",
    "高频",
    "易错",
    "已掌握",
    "模糊",
    "不会",
    "未学习",
  ]
  if (!filters.includes(filter)) filter = "今日背诵"
  function rebuild() {
    const now = new Date()
    queue = questions.filter((q) => {
      const p = progress[q.questionId]
      if (filter === "今日背诵") return priority(p, now) < 4
      if (filter === "今日到期复习") return !!p && Date.parse(p.nextReviewAt) <= now.getTime()
      if (["今日新背", "未学习"].includes(filter)) return !p
      if (filter === "已掌握") return p?.masteryStatus === "known"
      if (filter === "模糊") return p?.masteryStatus === "fuzzy"
      if (filter === "不会") return p?.masteryStatus === "unknown"
      return filter === "全部" || q.tags.includes(filter)
    })
    if (filter.startsWith("今日"))
      queue.sort(
        (a, b) =>
          priority(progress[a.questionId], now) - priority(progress[b.questionId], now) ||
          a.sourceNumber - b.sourceNumber,
      )
    index = Math.max(0, Math.min(index, queue.length - 1))
  }
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
    const node = document.createElement(tag)
    if (text !== undefined) node.textContent = text
    return node
  }
  function button(text: string, fn: () => void) {
    const b = el("button", text)
    b.type = "button"
    b.onclick = fn
    return b
  }
  function remember() {
    try {
      sessionStorage.setItem(
        sessionKey,
        JSON.stringify({
          filter,
          index,
          questionId: queue[index]?.questionId,
          scroll: window.scrollY,
        }),
      )
    } catch {
      /* Optional position cache. */
    }
  }
  function draw(focus = false) {
    const y = window.scrollY
    root!.replaceChildren()
    const stats = el("p")
    stats.setAttribute("role", "status")
    const known = questions.filter((q) => progress[q.questionId]?.masteryStatus === "known").length
    const today = Object.values(progress).filter(
      (p) => localDay(new Date(p.lastReviewedAt)) === localDay(),
    ).length
    stats.textContent = `当前 ${queue.length ? index + 1 : 0} / ${queue.length} · 今日完成 ${today} 题 · 掌握度 ${Math.round((known / questions.length) * 100)}%（${known}/${questions.length}）`
    root!.append(stats)
    const label = el("label", "筛选 ")
    const select = el("select")
    filters.forEach((f) => {
      const option = el("option", f)
      option.value = f
      select.append(option)
    })
    select.value = filter
    select.onchange = () => {
      filter = select.value
      index = 0
      level = 0
      rebuild()
      draw()
      remember()
    }
    label.append(select)
    root!.append(label)
    const categories = el(
      "p",
      `今日新背 ${questions.filter((q) => !progress[q.questionId]).length} · 到期 ${questions.filter((q) => progress[q.questionId] && Date.parse(progress[q.questionId].nextReviewAt) <= Date.now()).length} · 模糊 ${questions.filter((q) => progress[q.questionId]?.masteryStatus === "fuzzy").length} · 不会 ${questions.filter((q) => progress[q.questionId]?.masteryStatus === "unknown").length}`,
    )
    root!.append(categories)
    if (storageError) root!.append(el("p", storageError))
    const q = queue[index]
    if (!q) {
      root!.append(el("p", "本组已完成，切换筛选继续背诵。"))
      return
    }
    const card = el("article")
    card.className = "recall-card"
    const heading = el(
      "h2",
      `${q.sourceNumber}${/q\d+-/.test(q.questionId) ? `.${q.questionId.split("-").at(-1)}` : ""} · ${q.title}`,
    )
    heading.tabIndex = -1
    card.append(heading)
    card.append(
      el("p", `${q.tags.join(" · ")} · ${q.chapter} · 真题 ${q.exams.join(" / ") || "未标注"}`),
    )
    if (q.overlap) card.append(el("p", `重合考点 ${q.knowledgePointId}：${q.overlap}`))
    const buttons = el("div")
    buttons.className = "recall-actions"
    ;["提示关键词 · 10 秒", "显示采分点 · 30 秒", "显示完整答案 · 60 秒"].forEach((text, i) => {
      const b = button(text, () => {
        level = level === i + 1 ? 0 : i + 1
        draw()
      })
      b.setAttribute("aria-expanded", String(level === i + 1))
      b.setAttribute("aria-controls", "recall-answer")
      buttons.append(b)
    })
    card.append(buttons)
    const answer = el("div")
    answer.id = "recall-answer"
    answer.className = "recall-answer"
    if (level) {
      answer.append(
        el(
          "h3",
          ["", "10 秒关键词", "30 秒采分点（自动提取，请结合原文核对）", "60 秒完整答案（原文）"][
            level
          ],
        ),
      )
      if (level === 1) answer.append(el("p", q.keywords))
      else if (level === 2) {
        const list = el("ul")
        q.points.forEach((p) => list.append(el("li", p)))
        answer.append(list)
      } else {
        const full = el("div")
        if (q.answerHtml) full.innerHTML = q.answerHtml
        else full.textContent = plain(q.answer)
        full.className = "recall-full"
        answer.append(full)
      }
    }
    card.append(answer)
    const p = progress[q.questionId]
    card.append(
      el(
        "p",
        p
          ? `当前：${{ known: "会", fuzzy: "模糊", unknown: "不会" }[p.masteryStatus]} · 已复习 ${p.reviewCount} 次 · 下次 ${new Date(p.nextReviewAt).toLocaleDateString()}`
          : "当前：未学习",
      ),
    )
    const mastery = el("div")
    mastery.className = "recall-actions recall-mastery"
    ;(
      [
        ["会", "known"],
        ["模糊", "fuzzy"],
        ["不会", "unknown"],
      ] as [string, Mastery][]
    ).forEach(([text, status]) => {
      const b = button(text, () => {
        const updated = {
          ...progress,
          [q.questionId]: review(q.questionId, status, progress[q.questionId]),
        }
        try {
          if (blocked) throw new Error("storage blocked")
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, questions: updated }))
          progress = updated
          storageError = ""
        } catch {
          storageError = "保存失败，本次自评未保存。请检查浏览器存储后重试。"
          draw()
          return
        }
        // Keep the current queue stable while rating; rebuild when switching filters.
        draw()
        remember()
      })
      b.setAttribute("aria-pressed", String(p?.masteryStatus === status))
      mastery.append(b)
    })
    card.append(mastery)
    const nav = el("div")
    nav.className = "recall-actions"
    const prev = button("上一题", () => {
      index--
      level = 0
      draw(true)
      remember()
    })
    prev.disabled = index === 0
    const next = button("下一题", () => {
      index++
      level = 0
      draw(true)
      remember()
    })
    next.disabled = index === queue.length - 1
    nav.append(prev, next)
    card.append(nav)
    root!.append(card)
    window.scrollTo(0, y)
    if (focus) heading.focus({ preventScroll: true })
  }
  rebuild()
  if (resumeId) {
    const position = queue.findIndex((q) => q.questionId === resumeId)
    if (position >= 0) index = position
  }
  draw()
  requestAnimationFrame(() => window.scrollTo(0, scroll))
  const onScroll = () => remember()
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return
    try {
      progress = parseProgress(event.newValue)
      blocked = false
      storageError = ""
      rebuild()
      draw()
    } catch {
      blocked = true
      storageError = "其他页面的学习记录无法读取，暂不能保存。"
      draw()
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true })
  window.addEventListener("storage", onStorage)
  window.addCleanup(() => {
    window.removeEventListener("scroll", onScroll)
    window.removeEventListener("storage", onStorage)
  })
}
if (typeof document !== "undefined") document.addEventListener("nav", initRecall)
// Node test imports bypass the Quartz inline loader.
export default ""
