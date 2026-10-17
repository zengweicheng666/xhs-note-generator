import type { INoteRecord } from '@/data/note';

/** 小红书创作者中心发布页（图文） */
export const XHS_PUBLISH_URL =
  'https://creator.xiaohongshu.com/publish/publish?source=official';

/** 小红书标题上限 20 字 */
export const XHS_TITLE_LIMIT = 20;

export interface IPublishParts {
  title: string;
  /** 正文：配文 + 空行 + 内联 #话题 */
  body: string;
}

export interface IPublishOverride {
  caption?: string;
  tags?: string[];
}

/** 把当前记录组装成小红书发布所需的标题和正文（caption/tags 可用编辑后的值覆盖） */
export function buildPublishParts(
  record: INoteRecord,
  activeTitle: string,
  override?: IPublishOverride,
): IPublishParts {
  const title = (activeTitle || record.title || '').trim();
  const caption = (override?.caption ?? record.caption ?? '').trim();
  const tags = (override?.tags ?? record.tags ?? []).map((t) => `#${String(t).replace(/^#/, '').trim()}`).join(' ');
  const body = [caption, tags].filter(Boolean).join('\n\n');
  return { title, body };
}

/** 复制文本到剪贴板，兼容非 https / 旧浏览器 */
export async function copyText(text: string): Promise<void> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // fallthrough to legacy
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  ta.style.top = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  if (!ok) throw new Error('copy failed');
}
