import { useState, useCallback, useEffect } from 'react';
import { RefreshCw, Download, Image as ImageIcon, X } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit-lite';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Image } from '@/components/ui/image';
import { composeNoteImage, downloadDataUrlList } from '@/lib/image-composer';
import PublishDialog from './PublishDialog';
import { recordImages, type INoteRecord } from '@/data/note';

interface NoteResultCardProps {
  record: INoteRecord | null;
  isGenerating: boolean;
  stage: 'idle' | 'image' | 'text' | 'done';
  onRegenerate: () => void;
  /** 单独重新生成某一张配图（索引从 0 开始） */
  onRegenerateImage: (index: number) => void;
  /** 正在重新生成的图片索引，null 表示没有 */
  regeneratingIndex: number | null;
  /** 文案是否为本地离线兜底（非 AI 生成） */
  isOfflineCaption?: boolean;
}

export default function NoteResultCard({
  record,
  isGenerating,
  stage,
  onRegenerate,
  onRegenerateImage,
  regeneratingIndex,
  isOfflineCaption = false,
}: NoteResultCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [titleIdx, setTitleIdx] = useState(0);
  const [imageIdx, setImageIdx] = useState(0);

  const images = record ? recordImages(record) : [];
  const mainImage = images[imageIdx] || images[0] || '';
  const isRegeneratingCurrent = regeneratingIndex !== null;
  const isRegeneratingThis = regeneratingIndex === imageIdx;

  // 文案就地编辑状态
  const [editTitle, setEditTitle] = useState('');
  const [editCaption, setEditCaption] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // 切换到新记录时重置选中与编辑内容
  useEffect(() => {
    setTitleIdx(0);
    setImageIdx(0);
    if (record) {
      const t = record.titles?.length ? record.titles : [record.title];
      setEditTitle(t[0] || record.title || '');
      setEditCaption(record.caption || '');
      setEditTags(record.tags ? [...record.tags] : []);
    }
    setTagInput('');
  }, [record?.id]);

  const titles = record?.titles?.length ? record.titles : record?.title ? [record.title] : [];

  const handleDownload = useCallback(async () => {
    if (!record || !mainImage) return;
    setIsDownloading(true);
    try {
      const pages = await composeNoteImage(mainImage, editCaption, editTitle);
      const safeKeyword = record.keyword.replace(/[\\/:*?"<>|]/g, '_');
      const ok = await downloadDataUrlList(pages, `图文笔记_${safeKeyword}_${Date.now()}`);
      if (ok) {
        toast.success(pages.length > 1 ? `已保存 ${pages.length} 页图文（直接下载，未压缩）` : '图片已保存');
      } else {
        toast.error('图片保存失败，请重试');
      }
    } catch (error) {
      logger.error('下载失败:', String(error));
      toast.error('下载失败，请重试');
    } finally {
      setIsDownloading(false);
    }
  }, [record, mainImage, editTitle]);

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
            输入一个主题关键词，让 AI 帮你生成一张图文笔记 📝
          </p>
        </CardContent>
      </Card>
    );
  }

  const showImage = images.length > 0 || isGenerating;
  const showText = !!record?.title || isGenerating;

  return (
    <div className="w-full max-w-md mx-auto">
      {/* 小红书风格笔记卡片 */}
      <div className="bg-white rounded-2xl shadow-sm border border-border/50 overflow-hidden">
        {/* 图片区 */}
        <div className="aspect-[3/4] w-full bg-muted/30 relative overflow-hidden">
          {mainImage ? (
            <>
              <Image
                src={mainImage}
                alt={record?.title}
                loading="eager"
                decoding="auto"
                className="w-full h-full object-cover"
              />
              {/* 单张重新生成：重新生成当前这张，不影响其它图与文案 */}
              {!isGenerating && (
                <button
                  type="button"
                  onClick={() => onRegenerateImage(imageIdx)}
                  disabled={isRegeneratingCurrent}
                  title="重新生成当前这张配图"
                  className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/70 disabled:opacity-60"
                >
                  <RefreshCw className={'size-3.5 ' + (isRegeneratingThis ? 'animate-spin' : '')} />
                  {isRegeneratingThis ? '重新生成中' : '重新生成本张'}
                </button>
              )}
              {/* 该张重新生成中的遮罩 */}
              {isRegeneratingThis && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/70 backdrop-blur-sm">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <RefreshCw className="size-6 text-primary animate-spin" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    正在重新生成第 {imageIdx + 1} 张配图...
                  </p>
                </div>
              )}
              {images.length > 1 && (
                <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                  {imageIdx + 1} / {images.length}
                </span>
              )}
            </>
          ) : isGenerating ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <RefreshCw className="size-6 text-primary animate-spin" />
              </div>
              <p className="text-sm text-muted-foreground">
                {stage === 'image' ? 'AI 正在生成配图...' : stage === 'text' ? '正在生成文案...' : '生成中...'}
              </p>
            </div>
          ) : null}
        </div>

        {/* 多图缩略图切换（每张可单独重新生成） */}
        {images.length > 1 && !isGenerating && (
          <div className="flex gap-2 px-3 py-3 border-t border-border/50 overflow-x-auto">
            {images.map((src, i) => (
              <div key={`${src}-${i}`} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setImageIdx(i)}
                  className={
                    'block rounded-md overflow-hidden border-2 transition-all ' +
                    (i === imageIdx ? 'border-primary' : 'border-transparent hover:border-border')
                  }
                >
                  <Image
                    src={src}
                    alt={`配图${i + 1}`}
                    className="w-14 h-14 object-cover"
                  />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImageIdx(i);
                    onRegenerateImage(i);
                  }}
                  disabled={isRegeneratingCurrent}
                  title={`重新生成第 ${i + 1} 张`}
                  className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  <RefreshCw className={'size-3 ' + (regeneratingIndex === i ? 'animate-spin' : '')} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 文本区（可编辑） */}
        <div className="p-5 space-y-3">
          {/* 标题（可编辑 + 备选） */}
          {showText && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">标题（可编辑）</label>
                {isOfflineCaption && (
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                    离线示例文案
                  </span>
                )}
              </div>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="text-lg font-semibold h-11"
                placeholder="标题"
              />
              {titles.length > 1 && (
                <div className="space-y-1.5 pt-0.5">
                  <p className="text-xs text-muted-foreground">备选标题，点击填入：</p>
                  <div className="flex flex-wrap gap-1.5">
                    {titles.map((t, i) => (
                      <button
                        key={`${t}-${i}`}
                        type="button"
                        onClick={() => {
                          setTitleIdx(i);
                          setEditTitle(t);
                        }}
                        className={
                          'text-sm px-2.5 py-1 rounded-md border transition-colors ' +
                          (i === titleIdx
                            ? 'border-primary/50 bg-primary/5 text-foreground font-medium'
                            : 'border-border/60 text-muted-foreground hover:bg-muted/50')
                        }
                      >
                        {i + 1}. {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 配文（可编辑） */}
          {showText && (
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">正文（可编辑）</label>
              {record?.caption ? (
                <Textarea
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  className="text-sm leading-relaxed resize-none min-h-[120px]"
                  placeholder="正文"
                />
              ) : (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              )}
            </div>
          )}

          {/* 标签（可编辑） */}
          {showText && (
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">标签（可编辑，回车添加）</label>
              <div className="flex flex-wrap gap-1.5">
                {editTags.map((tag, idx) => (
                  <Badge
                    key={`${tag}-${idx}`}
                    variant="secondary"
                    className="text-xs font-normal bg-secondary/50 pl-2 pr-1 flex items-center gap-1"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => setEditTags((prev) => prev.filter((_, j) => j !== idx))}
                      className="ml-0.5 rounded-full hover:bg-black/10 p-0.5"
                      title="移除标签"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const v = tagInput.trim().replace(/^#/, '');
                    if (v && !editTags.includes(v)) setEditTags((prev) => [...prev, v]);
                    setTagInput('');
                  }
                }}
                className="text-sm h-9"
                placeholder="输入标签后回车，如：穿搭"
              />
            </div>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      {record && !isGenerating && (
        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            className="flex-1 h-11 px-2 text-sm"
            onClick={onRegenerate}
            disabled={regeneratingIndex !== null}
          >
            <RefreshCw className="size-4 mr-1.5" />
            换一换
          </Button>
          <Button
            variant="outline"
            className="flex-1 h-11 px-2 text-sm"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            <Download className="size-4 mr-1.5" />
            {isDownloading ? '合成中...' : '下载图片'}
          </Button>
          <PublishDialog
            record={record}
            activeTitle={editTitle}
            overrideCaption={editCaption}
            overrideTags={editTags}
          />
        </div>
      )}
    </div>
  );
}
