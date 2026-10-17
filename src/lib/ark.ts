// 火山方舟（豆包 Seedream 文生图 + 豆包文本模型）调用封装
// 走 Vite dev 代理 /ark-api；key 优先取界面设置（localStorage），代理层注入 Authorization

import { getSettings } from './settings'

export interface IArkNote {
  title: string
  titles: string[]
  content: string
  tags: string[]
}

function authHeaders(): Record<string, string> {
  const key = getSettings().apiKey.trim()
  // 界面设置的 key 通过自定义头交给 dev 代理转发；没设置时由代理回退 .env.local
  return key ? { 'x-ark-key': key } : {}
}

/**
 * 单次文生图请求，返回一张图片 URL（已走本地 /ark-img 代理）。
 * 说明：方舟 Seedream 的 n / sequential 组图对多数模型不生效或直接报错，
 * 因此多图统一用「每张各发一次请求」实现，避免出现「只出第一张」。
 */
async function requestImageOnce(
  keyword: string,
  index: number,
  total: number,
  extraHint = '',
  signal?: AbortSignal,
): Promise<string> {
  const { imageModel } = getSettings()
  const parts = [
    '极简清新插画风格的小红书笔记配图，纯白背景，',
    '主体明确、画面干净简洁，主题相关，',
    `主题关键词：${keyword}，适合作为小红书图文笔记封面，`,
    '构图居中、留白充足，无任何文字，整体治愈柔和。',
  ]
  if (total > 1) {
    parts.push(`这是第 ${index} 张（共 ${total} 张），请与其它张在构图、视角或色调上明显区别。`)
  }
  if (extraHint) parts.push(extraHint)
  const prompt = parts.join('')

  const resp = await fetch('/ark-api/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      model: imageModel,
      prompt,
      // Seedream 5.0：2K 档 3:4 竖图为 1728x2304（总像素需 ≥368 万）
      size: '1728x2304',
      response_format: 'url',
      stream: false,
      watermark: false,
    }),
    signal,
  })
  if (!resp.ok) {
    throw new Error(`image api ${resp.status}: ${await resp.text()}`)
  }
  const data = await resp.json()
  const arr: unknown[] = Array.isArray(data?.data) ? data.data : []
  const url = arr
    .map((it) => (it as { url?: string })?.url)
    .find((u): u is string => typeof u === 'string' && u.length > 0)
  if (!url) throw new Error('image api: empty url')
  // 走本地图片代理，保证 <img> 显示与 canvas 下载都不跨域
  return `/ark-img?u=${encodeURIComponent(url)}`
}

/** 失败自动重试一次（带退避）；已取消则直接抛出 */
async function withRetry<T>(fn: () => Promise<T>, signal?: AbortSignal, retries = 1): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (signal?.aborted || retries <= 0) throw error
    await new Promise((r) => setTimeout(r, 800))
    return withRetry(fn, signal, retries - 1)
  }
}

/** 调 Seedream 文生图，返回 count 张图片 URL 数组（并行多个单图请求，保证张数） */
export async function generateImage(
  keyword: string,
  count = 1,
  signal?: AbortSignal,
): Promise<string[]> {
  const total = Math.max(1, Math.min(Math.floor(count) || 1, 8))
  // 每批加随机变化，保证每次「换一换」视觉差异更大（背景保持纯白，避免不同张背景色不一致）
  const seed = Math.floor(Math.random() * 1_000_000)
  const variation = `整体基调保持清新治愈，保持纯白背景不变，可自由发挥构图与主体配色（批次变化 ${seed}）。`
  const tasks = Array.from({ length: total }, (_, i) =>
    withRetry(() => requestImageOnce(keyword, i + 1, total, variation, signal), signal),
  )
  const results = await Promise.allSettled(tasks)
  const urls = results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
    .map((r) => r.value)
  if (urls.length === 0) {
    const first = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined
    throw new Error(`image api: all ${total} requests failed: ${String(first?.reason ?? '')}`)
  }
  return urls
}

/**
 * 重新生成单张配图：带随机变化提示，尽量与现有画面不同，
 * 用于「单独重生成某一张」而不影响同一笔记的其它配图。
 */
export async function regenerateImage(keyword: string): Promise<string> {
  const seed = Math.floor(Math.random() * 1_000_000)
  // 关键：明确要求「保持纯白背景、风格不变」，仅在构图/视角/元素上变化，
  // 否则模型会把背景也换掉，导致重生成图片与首次生成的白色背景不一致。
  const hint =
    `请重新创作一张版本（变化编号 ${seed}）：保持纯白背景、画面干净简洁的风格不变，` +
    '仅在构图、视角、主体摆放或细节元素上做出区别，与之前的版本布局不同但整体调性一致。'
  return requestImageOnce(keyword, 1, 1, hint)
}

/** 调豆包文本模型，生成标题/配文/标签（JSON）；maxLen 控制正文最大字数 */
export async function generateNote(
  keyword: string,
  maxLen = 300,
  signal?: AbortSignal,
): Promise<IArkNote> {
  const { textModel } = getSettings()
  const system = [
    '你是小红书资深爆款文案写手，擅长把各种主题写成有吸引力、有干货、有共鸣的笔记。',
    '语言口语化、像真人分享一样自然，可少量使用颜文字。',
    '只输出 JSON，不要输出任何解释或 markdown。',
  ].join('')
  const minLen = Math.round(maxLen * 0.7)
  const user = [
    `主题关键词：${keyword}`,
    '请围绕这个关键词写一组小红书笔记文案，输出 JSON：',
    '{"titles":["备选标题1","备选标题2","备选标题3"],',
    `"content":"完整正文，语气口语化、像真人分享，句与句之间用\\\\n换行；字数控制在 ${minLen} 到 ${maxLen} 字之间（上限 ${maxLen} 字），有干货和共鸣感，可带少量颜文字",`,
    '"tags":["6个标签，不带#号，覆盖主题/场景/人群"]}',
    '要求：3个标题风格各不相同（一个吸睛、一个干货、一个共鸣），每个不超过20字。',
  ].join('\n')

  const resp = await fetch('/ark-api/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      model: textModel,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 1.1,
      max_tokens: 900,
    }),
    signal,
  })
  if (!resp.ok) {
    throw new Error(`text api ${resp.status}: ${await resp.text()}`)
  }
  const data = await resp.json()
  const raw: string = data?.choices?.[0]?.message?.content || ''
  return parseNoteJson(raw, keyword, maxLen)
}

function parseNoteJson(raw: string, keyword: string, maxLen = 300): IArkNote {
  // 容错：模型可能用 ```json 包裹
  const match = raw.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      const obj = JSON.parse(match[0])
      let titles: string[] = []
      if (Array.isArray(obj.titles)) {
        titles = obj.titles.map((t: unknown) => String(t).trim()).filter(Boolean).slice(0, 3)
      }
      if (titles.length === 0 && obj.title) titles = [String(obj.title)]
      return {
        title: titles[0] || `关于${keyword}的图文笔记`,
        titles,
        content: String(obj.content || '').slice(0, maxLen),
        tags: Array.isArray(obj.tags)
          ? obj.tags.map((t: unknown) => String(t).replace(/^#/, '')).slice(0, 8)
          : [],
      }
    } catch {
      // fallthrough
    }
  }
  return {
    title: `关于${keyword}的图文笔记`,
    titles: [`关于${keyword}的图文笔记`],
    content: raw.slice(0, 160) || '今天也要认真生活，把喜欢的事记录下来～',
    tags: ['图文笔记', '小红书', keyword],
  }
}
