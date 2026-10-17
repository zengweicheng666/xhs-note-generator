import { useState, useMemo, useCallback } from 'react';
import { Share2, Copy, Check, Download, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit-lite';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { exportRawImage, downloadDataUrlList } from '@/lib/image-composer';
import { buildPublishParts, copyText, XHS_PUBLISH_URL, XHS_TITLE_LIMIT } from '@/lib/publish';
import type { INoteRecord } from '@/data/note';
import { makeNoteLabel, recordImages } from '@/data/note';

interface PublishDialogProps {
  record: INoteRecord;
  activeTitle: string;
  overrideCaption?: string;
  overrideTags?: string[];
  /** 该记录的「日期+编号」短标签（由历史记录集合推导，保证唯一），用于文件名 */
  noteLabel?: string;
}

export default function PublishDialog({
  record,
  activeTitle,
  overrideCaption,
  overrideTags,
  noteLabel,
}: PublishDialogProps) {
  const [open, setOpen] = useState(false);
  const [prepping, setPrepping] = useState(false);
  const [preparedId, setPreparedId] = useState<string | null>(null);
  const [copied, setCopied] = useState<'title' | 'body' | null>(null);

  const parts = useMemo(
    () => buildPublishParts(record, activeTitle, { caption: overrideCaption, tags: overrideTags }),
    [record, activeTitle, overrideCaption, overrideTags],
  );
  const titleOver = parts.title.length > XHS_TITLE_LIMIT;

  // 主题描述可能很长，文件名统一用「日期 + 当日编号」
  const resolvedLabel = noteLabel || makeNoteLabel(record.createdAt);
  const images = recordImages(record);

  // 导出全部配图并依次直接下载（每张单独保存为 PNG，不打包成 zip）
  const downloadAllImages = useCallback(async (): Promise<number> => {
    if (images.length === 0) return 0;
    const dataUrls: string[] = [];
    for (let i = 0; i < images.length; i++) {
      try {
        dataUrls.push(await exportRawImage(images[i]));
      } catch (error) {
        logger.error(`导出第 ${i + 1} 张配图失败:`, String(error));
      }
    }
    if (dataUrls.length === 0) return 0;
    const ok = await downloadDataUrlList(dataUrls, `图文笔记_${resolvedLabel}`);
    return ok;
  }, [images, resolvedLabel]);

  const handleDownloadImage = useCallback(async () => {
    setPrepping(true);
    try {
      const ok = await downloadAllImages();
      if (ok > 0) {
        toast.success(
          images.length > 1
            ? `已打包下载 ${ok} 张配图（zip，与预览一致的 3:4 竖图）`
            : '已下载配图（与预览一致的 3:4 竖图）',
        );
      } else {
        toast.error('配图导出失败，请改用「下载图片」');
      }
    } catch (error) {
      logger.error('导出配图失败:', String(error));
      toast.error('配图导出失败，请重试');
    } finally {
      setPrepping(false);
    }
  }, [downloadAllImages, images.length]);

  // 打开弹窗时：自动复制正文 + 下载全部配图（两者互不影响，失败可手动）
  const handleOpen = useCallback(
    async (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen && preparedId !== record.id) {
        setPreparedId(record.id);
        setCopied(null);
        // 先复制正文：紧跟点击手势，最大化剪贴板权限成功率
        let copied = false;
        try {
          await copyText(parts.body);
          copied = true;
        } catch (error) {
          logger.warn('自动复制正文失败:', String(error));
        }
        // 再下载全部配图
        let downloaded = 0;
        try {
          downloaded = await downloadAllImages();
        } catch (error) {
          logger.error('导出配图失败:', String(error));
        }
        if (downloaded > 0 && copied) {
          toast.success(`已下载 ${downloaded} 张配图，正文已复制，可直接粘贴`);
        } else if (downloaded > 0) {
          toast.success(`已下载 ${downloaded} 张配图，正文可手动复制`);
        } else if (copied) {
          toast.success('正文已复制，配图可点「下载全部」');
        } else {
          toast.error('自动准备失败，可手动下载/复制');
        }
      }
    },
    [preparedId, record.id, downloadAllImages, parts.body],
  );

  const handleCopy = useCallback(
    async (which: 'title' | 'body') => {
      try {
        await copyText(which === 'title' ? parts.title : parts.body);
        setCopied(which);
        toast.success(which === 'title' ? '标题已复制' : '正文已复制');
        setTimeout(() => setCopied((c) => (c === which ? null : c)), 1500);
      } catch {
        toast.error('复制失败，请手动选择复制');
      }
    },
    [parts],
  );

  const handleOpenXhs = useCallback(() => {
    window.open(XHS_PUBLISH_URL, '_blank', 'noopener');
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <Button
        variant="outline"
        className="flex-1 h-11"
        onClick={() => handleOpen(true)}
      >
        <Share2 className="size-4 mr-2" />
        发布小红书
      </Button>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="size-4" />
            一键发布到小红书
          </DialogTitle>
          <DialogDescription>
            配图与预览完全一致（3:4 竖图）。受浏览器安全限制，图片需在发布页手动上传，标题正文已为你备好。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* 配图 */}
          <div className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
            <ImageIcon className="size-5 text-muted-foreground shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-medium">1. 配图（共 {images.length} 张）</p>
              <p className="text-xs text-muted-foreground">已自动下载全部；没有的话点右侧重下</p>
            </div>
            <Button size="sm" variant="secondary" onClick={handleDownloadImage} disabled={prepping}>
              <Download className="size-3.5 mr-1" />
              {prepping ? '导出中' : '下载全部'}
            </Button>
          </div>

          {/* 标题 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">2. 标题</label>
              <span className={'text-xs ' + (titleOver ? 'text-destructive' : 'text-muted-foreground')}>
                {parts.title.length}/{XHS_TITLE_LIMIT}
                {titleOver ? ' 超长，建议精简' : ''}
              </span>
            </div>
            <div className="flex gap-2">
              <Input value={parts.title} readOnly className="text-sm" />
              <Button size="sm" variant="secondary" className="shrink-0" onClick={() => handleCopy('title')}>
                {copied === 'title' ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </div>

          {/* 正文 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">3. 正文（含话题，已自动复制）</label>
              <Button size="sm" variant="secondary" className="h-7" onClick={() => handleCopy('body')}>
                {copied === 'body' ? <Check className="size-3.5 mr-1" /> : <Copy className="size-3.5 mr-1" />}
                复制
              </Button>
            </div>
            <Textarea value={parts.body} readOnly rows={6} className="text-sm leading-relaxed resize-none" />
          </div>

          <ol className="text-xs text-muted-foreground space-y-1 leading-relaxed list-decimal list-inside">
            <li>点下方按钮打开小红书创作者发布页（首次需扫码登录）。</li>
            <li>选「上传图文」，把刚下载的配图（{images.length > 1 ? `图文笔记_${resolvedLabel}_1.png ~ 图文笔记_${resolvedLabel}_${images.length}.png` : `图文笔记_${resolvedLabel}.png`}）按顺序上传，保持原 3:4 比例。</li>
            <li>标题栏粘贴标题、正文框粘贴正文；确认无误后点「发布」。</li>
          </ol>
        </div>

        <Button className="w-full h-11" onClick={handleOpenXhs}>
          <ExternalLink className="size-4 mr-2" />
          打开小红书发布页
        </Button>
      </DialogContent>
    </Dialog>
  );
}
