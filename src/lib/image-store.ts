// 配图本地持久化：把方舟返回的「24 小时临时链接」转存到工程 public/notes/ 下，
// 前端改用稳定的本地 URL（/notes/<日期>/<名称>.<ext>），历史记录里的图才不会过期失效。
// 保存失败时回退成原来的代理链接，保证功能不中断。

import { logger } from '@lark-apaas/client-toolkit-lite'

/** 本地图片前缀（由 vite dev 直接以静态资源提供） */
const LOCAL_PREFIX = '/notes/'

/** 把 /ark-img?u=<远端地址> 还原成方舟原始地址 */
export function extractRemoteUrl(arkImgUrl: string): string {
  if (!arkImgUrl.startsWith('/ark-img')) return arkImgUrl
  const query = arkImgUrl.slice(arkImgUrl.indexOf('?') + 1)
  const raw = new URLSearchParams(query).get('u') || ''
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/** 判断是否已经是本地持久化的图片 */
export function isLocalImageUrl(url: string): boolean {
  return url.startsWith(LOCAL_PREFIX)
}

/**
 * 把单张配图保存到工程目录，返回本地 URL；失败返回 null（调用方回退原链接）。
 */
export async function persistImage(
  imageUrl: string,
  name: string,
): Promise<string | null> {
  // 已经是本地图 / 占位图（dataURL）等，无需重复保存
  if (!imageUrl || isLocalImageUrl(imageUrl) || imageUrl.startsWith('data:')) {
    return null
  }
  try {
    const remote = extractRemoteUrl(imageUrl)
    if (!remote) return null
    const resp = await fetch('/api/save-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: remote, name }),
    })
    if (!resp.ok) return null
    const data = (await resp.json()) as { url?: string }
    return typeof data?.url === 'string' && data.url ? data.url : null
  } catch (error) {
    logger.warn('配图保存到本地目录失败:', String(error))
    return null
  }
}

/**
 * 批量保存配图。baseName 为「日期+编号」短标签，多张时自动补 _1/_2 后缀。
 * 单张保存失败不影响其它张，失败的那张保留原链接。
 */
export async function persistImages(urls: string[], baseName: string): Promise<string[]> {
  return Promise.all(
    urls.map(async (url, i) => {
      const saved = await persistImage(url, urls.length > 1 ? `${baseName}_${i + 1}` : baseName)
      return saved ?? url
    }),
  )
}
