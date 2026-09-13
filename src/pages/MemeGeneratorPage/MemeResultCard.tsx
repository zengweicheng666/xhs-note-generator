import { useState, useCallback } from 'react';
import { RefreshCw, Download, Image as ImageIcon } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit-lite';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Image } from '@/components/ui/image';
import { composeMemeImage, downloadImage } from '@/lib/image-composer';
import type { IMemeRecord } from '@/data/meme';

interface MemeResultCardProps {
  record: IMemeRecord | null;
  isGenerating: boolean;
  stage: 'idle' | 'image' | 'text' | 'done';
  onRegenerate: () => void;
}

export default function MemeResultCard({
  record,
  isGenerating,
  stage,
  onRegenerate,
}: MemeResultCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!record) return;
    setIsDownloading(true);
    try {
      const dataUrl = await composeMemeImage(record.imageUrl, record.caption, record.title);
      const safeKeyword = record.keyword.replace(/[\\/:*?"<>|]/g, '_');
      downloadImage(dataUrl, `自嘲熊_${safeKeyword}_${Date.now()}.png`);
      toast.success('图片已保存');
    } catch (error) {
      logger.error('下载失败:', String(error));
      toast.error('下载失败，请重试');
    } finally {
      setIsDownloading(false);
    }
  }, [record]);

  // 空状态
  if (!record && !isGenerating) {
    return (
      <Card className="w-full max-w-md mx-auto bg-white/80 backdrop-blur">
        <CardContent className="p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <ImageIcon className="size-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            还没有生成记录
          </h3>
          <p className="text-sm text-muted-foreground">
            输入一个情绪关键词，让自嘲熊帮你画一张表情包笔记 🐻
          </p>
        </CardContent>
      </Card>
    );
  }

  const showImage = !!record?.imageUrl || isGenerating;
  const showText = !!record?.title || isGenerating;

  return (
    <div className="w-full max-w-md mx-auto">
      {/* 小红书风格笔记卡片 */}
      <div className="bg-white rounded-2xl shadow-sm border border-border/50 overflow-hidden">
        {/* 图片区 */}
        <div className="aspect-[3/4] w-full bg-muted/30 relative overflow-hidden">
          {record?.imageUrl ? (
            <Image
              src={record.imageUrl}
              alt={record.title}
              className="w-full h-full object-cover"
            />
          ) : isGenerating ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <RefreshCw className="size-6 text-primary animate-spin" />
              </div>
              <p className="text-sm text-muted-foreground">
                {stage === 'image' ? '自嘲熊正在画画...' : stage === 'text' ? '正在想文案...' : '生成中...'}
              </p>
            </div>
          ) : null}
        </div>

        {/* 文本区 */}
        <div className="p-5 space-y-3">
          {/* 标题 */}
          {showText && (
            <div>
              {record?.title ? (
                <h2 className="text-lg font-semibold text-foreground leading-snug">
                  {record.title}
                </h2>
              ) : (
                <Skeleton className="h-6 w-4/5 mb-2" />
              )}
            </div>
          )}

          {/* 配文 */}
          {showText && (
            <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
              {record?.caption ? (
                record.caption
              ) : (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              )}
            </div>
          )}

          {/* 标签 */}
          {record?.tags && record.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {record.tags.map((tag, idx) => (
                <Badge
                  key={`${tag}-${idx}`}
                  variant="secondary"
                  className="text-xs font-normal bg-secondary/50"
                >
                  #{tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* 操作按钮 */}
      {record && !isGenerating && (
        <div className="flex gap-3 mt-4">
          <Button
            variant="outline"
            className="flex-1 h-11"
            onClick={onRegenerate}
          >
            <RefreshCw className="size-4 mr-2" />
            换一换
          </Button>
          <Button
            className="flex-1 h-11"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            <Download className="size-4 mr-2" />
            {isDownloading ? '合成中...' : '下载图片'}
          </Button>
        </div>
      )}
    </div>
  );
}
