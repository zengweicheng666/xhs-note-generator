// 火山方舟（豆包 Seedream 文生图 + 豆包文本模型）调用封装
// 走 Vite dev 代理 /ark-api；key 优先取界面设置（localStorage），代理层注入 Authorization

import { getSettings } from './settings'
import { DEFAULT_STYLE_ID, getStylePrompt } from '@/data/note'

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
  styleId: string = DEFAULT_STYLE_ID,
): Promise<string> {
  const { imageModel } = getSettings()
  const parts = [
    `${getStylePrompt(styleId)}的小红书笔记配图，纯白背景，`,
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
  styleId: string = DEFAULT_STYLE_ID,
): Promise<string[]> {
  const total = Math.max(1, Math.min(Math.floor(count) || 1, 8))
  // 每批加随机变化，保证每次「换一换」视觉差异更大（背景保持纯白，避免不同张背景色不一致）
  const seed = Math.floor(Math.random() * 1_000_000)
  const variation = `${getStylePrompt(styleId)}，整体基调保持清新治愈，保持纯白背景不变，可自由发挥构图与主体配色（批次变化 ${seed}）。`
  const tasks = Array.from({ length: total }, (_, i) =>
    withRetry(() => requestImageOnce(keyword, i + 1, total, variation, signal, styleId), signal),
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
export async function regenerateImage(
  keyword: string,
  styleId: string = DEFAULT_STYLE_ID,
): Promise<string> {
  const seed = Math.floor(Math.random() * 1_000_000)
  // 关键：明确要求「保持纯白背景、所选风格不变」，仅在构图/视角/元素上变化，
  // 否则模型会把背景或风格也换掉，导致重生成图片与首次生成不一致。
  const hint =
    `请重新创作一张版本（变化编号 ${seed}）：保持纯白背景、${getStylePrompt(styleId)}的风格不变，` +
    '仅在构图、视角、主体摆放或细节元素上做出区别，与之前的版本布局不同但整体调性一致。'
  return requestImageOnce(keyword, 1, 1, hint, undefined, styleId)
}

/** 调豆包文本模型，生成标题/配文/标签（JSON）；maxLen 控制正文最大字数 */
export async function generateNote(
  keyword: string,
  maxLen = 300,
  signal?: AbortSignal,
): Promise<IArkNote> {
  const { textModel } = getSettings()
  const system = [
    '你是小红书资深爆款文案写手，擅长把任何主题写成有吸引力、有干货、有共鸣的笔记。',
    '写作要求：',
    '1. 开头一两句就抓住人：用具体场景、痛点或反差切入，不要空泛抒情，不要「今天给大家分享」这类套话开场。',
    '2. 正文用 2-4 个分点讲清楚，每点要有具体细节、方法、数量或例子，避免空话和形容词堆砌。',
    '3. 语气像真人分享：口语化、真诚、有画面感，克制使用颜文字（每段最多 1 个）。',
    '4. 结尾一句总结或互动引导，自然收束。',
    '5. 不夸大承诺、不编造数据、不写空洞口号，不重复同一句话。',
    '只输出 JSON，不要输出任何解释或 markdown。',
  ].join('\n')
  const minLen = Math.round(maxLen * 0.7)
  const user = [
    `主题关键词：${keyword}`,
    '请围绕这个关键词写一组小红书笔记文案，只输出 JSON（不要 markdown 代码块）：',
    '{',
    '  "titles": ["备选标题1","备选标题2","备选标题3"],',
    `  "content": "正文：开头钩子 1-2 句；然后 2-4 个分点，每点用「①」「②」或 emoji 开头并单独成段；结尾 1 句总结或互动引导。段落之间用一个空行分隔，JSON 字符串里的换行用 \\n 表示。总字数 ${minLen}-${maxLen} 字。",`,
    '  "tags": ["6个标签，不带#号，覆盖主题/场景/人群"]',
    '}',
    '要求：',
    '1. 三个标题风格各异（吸睛型、干货型、共鸣型），每个不超过 20 字，不堆砌感叹号；',
    '2. content 必须是合法 JSON 字符串，内部换行用 \\n 表示，不要出现未转义的真实换行；',
    '3. 排版清晰：分段明确、每点独立成行，可直接复制发布。',
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
      // 0.9 兼顾文采与稳定：过高容易语句发散、逻辑断裂
      temperature: 0.9,
      max_tokens: 1200,
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

/**
 * 规范化正文排版：
 * 1. 模型有时输出字面的 \n / \\n（反斜杠+n）而不是真实换行，这里统一转成真实换行；
 * 2. 去掉行尾空白；3 个以上连续换行压缩为 1 个空行，避免段落间距失控。
 */
export function normalizeNoteText(raw: string): string {
  return String(raw ?? '')
    .replace(/\\+r\\+n/g, '\n')
    .replace(/\\+n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parseNoteJson(raw: string, keyword: string, maxLen = 300): IArkNote {
  // 容错：模型可能用 ```json 包裹
  const match = raw.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      const obj = JSON.parse(match[0])
      let titles: string[] = []
      if (Array.isArray(obj.titles)) {
        titles = obj.titles
          .map((t: unknown) => String(t).replace(/\s+/g, ' ').trim())
          .filter(Boolean)
          .slice(0, 3)
      }
      if (titles.length === 0 && obj.title) {
        titles = [String(obj.title).replace(/\s+/g, ' ').trim()]
      }
      return {
        title: titles[0] || `关于${keyword}的图文笔记`,
        titles,
        content: normalizeNoteText(obj.content).slice(0, maxLen),
        tags: Array.isArray(obj.tags)
          ? obj.tags.map((t: unknown) => String(t).replace(/^#/, '').trim()).slice(0, 8)
          : [],
      }
    } catch {
      // fallthrough
    }
  }
  return {
    title: `关于${keyword}的图文笔记`,
    titles: [`关于${keyword}的图文笔记`],
    content: normalizeNoteText(raw).slice(0, 160) || '今天也要认真生活，把喜欢的事记录下来～',
    tags: ['图文笔记', '小红书', keyword],
  }
}
