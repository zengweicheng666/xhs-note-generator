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

/** 调 Seedream 文生图，返回图片 URL */
export async function generateBearImage(keyword: string): Promise<string> {
  const { imageModel } = getSettings()
  const prompt = [
    '极简黑白线条简笔画表情包，纯白色背景，黑色粗描边，',
    '圆滚滚的白色小熊（chiikawa / 自嘲熊 nagano 画风），',
    `情绪与场景关键词：${keyword}，动作和表情夸张可爱，`,
    '画面简洁干净，无任何文字，正方形构图，大量留白，手绘感。',
  ].join('')

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
  })
  if (!resp.ok) {
    throw new Error(`image api ${resp.status}: ${await resp.text()}`)
  }
  const data = await resp.json()
  const url = data?.data?.[0]?.url
  if (!url) throw new Error('image api: empty url')
  // 走本地图片代理，保证 <img> 显示与 canvas 下载都不跨域
  return `/ark-img?u=${encodeURIComponent(url)}`
}

/** 调豆包文本模型，生成标题/配文/标签（JSON） */
export async function generateBearNote(keyword: string): Promise<IArkNote> {
  const { textModel } = getSettings()
  const system = [
    '你是小红书表情包账号的资深文案写手，模仿「表情包局长」风格：',
    '打工人自嘲、丧中带治愈、扎心又好笑、口语化，可少量使用颜文字。',
    '只输出 JSON，不要输出任何解释或 markdown。',
  ].join('')
  const user = [
    `情绪关键词：${keyword}`,
    '请围绕这个关键词写一组小红书表情包笔记文案，输出 JSON：',
    '{"titles":["备选标题1","备选标题2","备选标题3"],',
    '"content":"完整正文，4到6句、120到180字，句与句之间用\\n换行，像真人发的小红书，有情绪起伏和共鸣感，可带少量颜文字",',
    '"tags":["6个标签，不带#号，覆盖情绪/场景/人群"]}',
    '要求：3个标题风格各不相同（一个扎心、一个搞笑、一个治愈），每个不超过20字。',
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
  })
  if (!resp.ok) {
    throw new Error(`text api ${resp.status}: ${await resp.text()}`)
  }
  const data = await resp.json()
  const raw: string = data?.choices?.[0]?.message?.content || ''
  return parseNoteJson(raw, keyword)
}

function parseNoteJson(raw: string, keyword: string): IArkNote {
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
        title: titles[0] || `关于${keyword}的自嘲熊`,
        titles,
        content: String(obj.content || '').slice(0, 240),
        tags: Array.isArray(obj.tags)
          ? obj.tags.map((t: unknown) => String(t).replace(/^#/, '')).slice(0, 8)
          : [],
      }
    } catch {
      // fallthrough
    }
  }
  return {
    title: `关于${keyword}的自嘲熊`,
    titles: [`关于${keyword}的自嘲熊`],
    content: raw.slice(0, 160) || '今天也是被生活拿捏的一天…',
    tags: ['自嘲熊', '打工人', '表情包'],
  }
}
