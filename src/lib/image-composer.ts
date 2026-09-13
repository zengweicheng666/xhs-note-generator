import { logger } from '@lark-apaas/client-toolkit-lite';

/**
 * 将表情包图片和配文合成到一张 3:4 比例的画布上，模拟小红书笔记图风格
 * 上半部分：图片
 * 下半部分：白色背景 + 黑色大字配文
 */
export async function composeMemeImage(
  imageUrl: string,
  caption: string,
  title: string,
): Promise<string> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  const width = 1080;
  const height = 1440; // 3:4
  canvas.width = width;
  canvas.height = height;

  // 白底
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // 加载图片
  const img = await loadImage(imageUrl);

  // 上半部分放图片（正方形区域，居中；缩小以给更多文案留空间）
  const imgAreaTop = 40;
  const imgAreaSize = 820;
  const imgAreaX = (width - imgAreaSize) / 2;
  drawImageCover(ctx, img, imgAreaX, imgAreaTop, imgAreaSize, imgAreaSize);

  // 图片边框
  ctx.strokeStyle = '#e5e5e5';
  ctx.lineWidth = 2;
  ctx.strokeRect(imgAreaX, imgAreaTop, imgAreaSize, imgAreaSize);

  // 标题
  const titleY = imgAreaTop + imgAreaSize + 50;
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 46px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'left';
  wrapText(ctx, title, 60, titleY, width - 120, 60, 2);

  // 配文
  const captionY = titleY + 130;
  ctx.fillStyle = '#444444';
  ctx.font = '30px "PingFang SC", "Microsoft YaHei", sans-serif';
  wrapText(ctx, caption, 60, captionY, width - 120, 46, 7);

  // 底部水印
  ctx.fillStyle = '#cccccc';
  ctx.font = '24px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('—— 自嘲熊表情包 ——', width / 2, height - 40);

  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      logger.warn('图片加载失败，尝试不带 crossOrigin');
      const img2 = new Image();
      img2.onload = () => resolve(img2);
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
