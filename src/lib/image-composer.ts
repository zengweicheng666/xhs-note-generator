import { logger } from '@lark-apaas/client-toolkit-lite';

const PAGE_W = 1080;
const PAGE_H = 1440; // 3:4
// 单页可放置的正文字符数（按画布估算，留足余量）
const CHARS_PER_PAGE = 200;

/** 已加载图片缓存，避免导出/合成时重复拉取原图 */
const imageCache = new Map<string, HTMLImageElement>();

/**
 * 将笔记配图和文字合成成一组 3:4 比例的页面（PNG dataURL 数组）。
 * 第 1 页含配图 + 标题 + 正文首段；正文过长时自动拆成多页文字页，保证全文不截断。
 * 解决「正文字数上限 1000 但合成图只放得下约 220 字」的矛盾。
 */
export async function composeNoteImage(
  imageUrl: string,
  caption: string,
  title: string,
): Promise<string[]> {
  const img = await loadImage(imageUrl);
  const cleanTitle = (title || '').trim() || '图文笔记';
  const cleanCaption = (caption || '').trim();
  const pages: string[] = [];

  if (!cleanCaption) {
    pages.push(renderImagePage(img, cleanTitle, ''));
    return pages;
  }

  const chunks = splitIntoChunks(cleanCaption, CHARS_PER_PAGE);
  pages.push(renderImagePage(img, cleanTitle, chunks[0]));
  for (let i = 1; i < chunks.length; i++) {
    pages.push(renderTextPage(cleanTitle, chunks[i], i + 1, chunks.length));
  }
  return pages;
}

/** 第 1 页：配图 + 标题 + 首段正文 */
function renderImagePage(img: HTMLImageElement, title: string, captionChunk: string): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);

  const imgAreaTop = 40;
  const imgAreaSize = 820;
  const imgAreaX = (PAGE_W - imgAreaSize) / 2;
  drawImageCover(ctx, img, imgAreaX, imgAreaTop, imgAreaSize, imgAreaSize);

  ctx.strokeStyle = '#e5e5e5';
  ctx.lineWidth = 2;
  ctx.strokeRect(imgAreaX, imgAreaTop, imgAreaSize, imgAreaSize);

  const titleY = imgAreaTop + imgAreaSize + 50;
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 46px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'left';
  wrapText(ctx, title, 60, titleY, PAGE_W - 120, 60, 2);

  const captionY = titleY + 130;
  drawTextBlock(ctx, captionChunk, {
    x: 60,
    y: captionY,
    maxWidth: PAGE_W - 120,
    lineHeight: 44,
    maxBottom: PAGE_H - 90,
    font: '30px "PingFang SC", "Microsoft YaHei", sans-serif',
    color: '#444444',
  });

  drawWatermark(ctx);
  return canvas.toDataURL('image/png');
}

/** 续页：纯文字页（标题 + 正文片段 + 页码） */
function renderTextPage(title: string, captionChunk: string, pageNo: number, total: number): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);

  ctx.fillStyle = '#1a1a1a';
  ctx.textAlign = 'left';
  ctx.font = 'bold 40px "PingFang SC", "Microsoft YaHei", sans-serif';
  wrapText(ctx, title, 60, 90, PAGE_W - 120, 56, 2);

  drawTextBlock(ctx, captionChunk, {
    x: 60,
    y: 230,
    maxWidth: PAGE_W - 120,
    lineHeight: 46,
    maxBottom: PAGE_H - 130,
    font: '30px "PingFang SC", "Microsoft YaHei", sans-serif',
    color: '#444444',
  });

  ctx.fillStyle = '#bdbdbd';
  ctx.textAlign = 'center';
  ctx.font = '24px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText(`${pageNo} / ${total}`, PAGE_W / 2, PAGE_H - 80);

  drawWatermark(ctx);
  return canvas.toDataURL('image/png');
}

function drawWatermark(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#cccccc';
  ctx.textAlign = 'center';
  ctx.font = '24px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText('—— 通用图文笔记 ——', PAGE_W / 2, PAGE_H - 40);
}

/** 按标点切分正文为多个片段，单段不超过 size 字；超长句子再硬切 */
function splitIntoChunks(text: string, size: number): string[] {
  const sentences = text.split(/(?<=[。！？!?；;\n])/);
  const chunks: string[] = [];
  let cur = '';
  for (const s of sentences) {
    if (!s) continue;
    if (cur.length + s.length <= size) {
      cur += s;
    } else if (s.length > size) {
      if (cur) {
        chunks.push(cur);
        cur = '';
      }
      for (let i = 0; i < s.length; i += size) chunks.push(s.slice(i, i + size));
    } else {
      chunks.push(cur);
      cur = s;
    }
  }
  if (cur) chunks.push(cur);
  return chunks.length ? chunks : [text];
}

/**
 * 生成一张离线兜底的占位配图（AI 配图失败时用作笔记封面）。
 * 中性柔和的背景 + 主题关键词大字，无品牌强绑定，可作为通用封面使用。
 */
export async function createPlaceholderImage(keyword: string): Promise<string> {
  const size = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  // 柔和米色渐变背景
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#faf7f2');
  grad.addColorStop(1, '#efe9df');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // 浅色圆角卡片
  const pad = 90;
  roundRect(ctx, pad, pad, size - pad * 2, size - pad * 2, 36);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#e7e0d4';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 顶部小标签
  ctx.fillStyle = '#b9a98f';
  ctx.font = '28px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('图文笔记 · 占位封面', size / 2, 220);

  // 关键词大字
  ctx.fillStyle = '#3a3a3a';
  ctx.font = 'bold 72px "PingFang SC", "Microsoft YaHei", sans-serif';
  wrapText(ctx, keyword || '我的图文笔记', 140, size / 2 - 40, size - 280, 92, 3);

  // 底部说明
  ctx.fillStyle = '#b9a98f';
  ctx.font = '26px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText('AI 配图暂不可用，已生成占位图', size / 2, size - 200);

  return canvas.toDataURL('image/png');
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => {
      logger.warn('图片加载失败，尝试不带 crossOrigin');
      const img2 = new Image();
      img2.onload = () => {
        imageCache.set(src, img2);
        resolve(img2);
      };
      img2.onerror = reject;
      img2.src = src;
    };
    img.src = src;
  });
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const ratio = img.width / img.height;
  const targetRatio = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;

  if (ratio > targetRatio) {
    // 图片更宽，裁两边
    sw = img.height * targetRatio;
    sx = (img.width - sw) / 2;
  } else {
    // 图片更高，裁上下
    sh = img.width / targetRatio;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/** 按宽度把「一段纯文本」换行（不处理 \n），返回行数组 */
function wrapParagraph(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const chars = text.split('');
  const lines: string[] = [];
  let line = '';
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line !== '') {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * 段落感知的文本块绘制（修复排版混乱）：
 * - 尊重正文里的 \n 换行，段落之间留半行间距，不再把所有字挤成一坨
 * - 段落内按宽度自动换行，绘制到 maxBottom 为止，空间不足时最后一行加省略号
 */
function drawTextBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  opts: {
    x: number;
    y: number;
    maxWidth: number;
    lineHeight: number;
    maxBottom: number;
    font: string;
    color: string;
  },
) {
  ctx.save();
  ctx.font = opts.font;
  ctx.fillStyle = opts.color;
  ctx.textAlign = 'left';

  const gap = opts.lineHeight * 0.5;
  const paragraphs = String(text).split('\n');
  let y = opts.y;
  let lastWasGap = false;

  for (const para of paragraphs) {
    const p = para.trim();
    if (!p) {
      // 空行只补一次间距，避免连续空行浪费版面
      if (!lastWasGap && y > opts.y) {
        y += gap;
        lastWasGap = true;
      }
      continue;
    }
    for (const line of wrapParagraph(ctx, p, opts.maxWidth)) {
      if (y + opts.lineHeight > opts.maxBottom) {
        let last = line;
        while (last.length > 1 && ctx.measureText(`${last}…`).width > opts.maxWidth) {
          last = last.slice(0, -1);
        }
        ctx.fillText(`${last}…`, opts.x, y);
        ctx.restore();
        return;
      }
      ctx.fillText(line, opts.x, y);
      y += opts.lineHeight;
      lastWasGap = false;
    }
  }
  ctx.restore();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const chars = text.split('');
  let line = '';
  let lines: string[] = [];

  for (let i = 0; i < chars.length; i++) {
    const testLine = line + chars[i];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line !== '') {
      lines.push(line);
      line = chars[i];
      if (lines.length >= maxLines - 1) {
        // 最后一行加省略号
        let lastLine = line;
        let j = i + 1;
        while (j < chars.length) {
          const test = lastLine + chars[j];
          if (ctx.measureText(test + '…').width > maxWidth) break;
          lastLine = test;
          j++;
        }
        lines.push(lastLine + (j < chars.length ? '…' : ''));
        break;
      }
    } else {
      line = testLine;
    }
  }

  if (lines.length < maxLines && line) {
    lines.push(line);
  }

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, y + i * lineHeight);
  }
}

export function downloadImage(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 依次下载一组 dataURL（多页合成图 / 多张配图）。
 * 张间留间隔，减少被浏览器「一次性多下载」保护拦截的概率。
 */
export async function downloadDataUrlList(pages: string[], baseName: string): Promise<number> {
  let ok = 0;
  for (let i = 0; i < pages.length; i++) {
    try {
      const suffix = pages.length > 1 ? `_${i + 1}` : '';
      downloadImage(pages[i], `${baseName}${suffix}.png`);
      ok++;
    } catch (error) {
      logger.error(`下载第 ${i + 1} 张失败:`, String(error));
    }
    if (i < pages.length - 1) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  return ok;
}

/**
 * 按原始尺寸导出配图（不叠加文字），用于发布小红书：
 * 与页面预览完全一致的 3:4 竖图，PNG 保证清晰度。
 */
export async function exportRawImage(imageUrl: string): Promise<string> {
  const img = await loadImage(imageUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/png');
}
