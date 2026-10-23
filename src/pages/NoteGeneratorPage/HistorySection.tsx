import { useEffect, useState } from 'react';
import { Image } from '@/components/ui/image';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ImageOff, RefreshCw, Trash2 } from 'lucide-react';
import { makeNoteLabel, recordImages, type INoteRecord } from '@/data/note';

interface HistorySectionProps {
  history: INoteRecord[];
  onSelect: (record: INoteRecord) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  selectedId?: string;
  /** 检测到配图失效的记录变化时上报（失效 = 方舟链接超过 24 小时） */
  onExpiredIdsChange?: (ids: Record<string, boolean>) => void;
  /** 一键重新生成所有失效配图 */
  onRegenerateExpired?: () => void;
  /** 是否正在批量重新生成 */
  regeneratingExpired?: boolean;
}

export default function HistorySection({
  history,
  onSelect,
  onDelete,
  onClear,
  selectedId,
  onExpiredIdsChange,
  onRegenerateExpired,
  regeneratingExpired = false,
}: HistorySectionProps) {
  // 配图加载失败的记录（方舟链接超过 24 小时失效）
  const [failedIds, setFailedIds] = useState<Record<string, boolean>>({});

  const failedCount = history.filter((r) => failedIds[r.id]).length;

  useEffect(() => {
    onExpiredIdsChange?.(failedIds);
  }, [failedIds, onExpiredIdsChange]);

  // 记录的配图更新为本地地址后，自动清掉它的失效标记（如批量重新生成完成后）
  useEffect(() => {
    setFailedIds((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const record of history) {
        const urls = recordImages(record);
        const nowLocal =
          urls.length > 0 && urls.every((u) => typeof u === 'string' && u.startsWith('/notes/'));
        if (prev[record.id] && nowLocal) {
          delete next[record.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [history]);

  if (history.length === 0) return null;

  const handleClear = () => {
    if (window.confirm('确定清空全部历史记录？')) onClear();
  };

  const handleRegenerateExpired = () => {
    if (
      failedCount > 0 &&
      window.confirm(
        `检测到 ${failedCount} 条历史记录的配图已失效（方舟链接仅 24 小时有效，原图已无法取回）。\n\n` +
          '将按原主题和风格重新生成这些配图（不是原图，会消耗生图额度），确定继续？',
      )
    ) {
      onRegenerateExpired?.();
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-foreground">最近生成</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{history.length} 条</span>
          {failedCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={handleRegenerateExpired}
              disabled={regeneratingExpired}
            >
              <RefreshCw className={'size-3 mr-1 ' + (regeneratingExpired ? 'animate-spin' : '')} />
              {regeneratingExpired ? '重新生成中...' : `修复 ${failedCount} 条失效配图`}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
            onClick={handleClear}
          >
            清空
          </Button>
        </div>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-2">
          {history.map((record) => (
            <div key={record.id} className="shrink-0 group relative">
              <button onClick={() => onSelect(record)} className="block">
                <div
                  className="w-24 h-32 rounded-lg overflow-hidden border-2 transition-all bg-muted"
                  style={{
                    borderColor: selectedId === record.id ? 'hsl(22 60% 45%)' : 'transparent',
                  }}
                >
                  {failedIds[record.id] ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground">
                      <ImageOff className="size-5" />
                      <span className="text-[10px]">图片已失效</span>
                    </div>
                  ) : (
                    <Image
                      src={recordImages(record)[0] || ''}
                      alt={record.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={() => setFailedIds((prev) => ({ ...prev, [record.id]: true }))}
                    />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-[96px] truncate">
                  {makeNoteLabel(record.createdAt, record.seq)}
                </p>
              </button>
              <button
                type="button"
                onClick={() => onDelete(record.id)}
                title="删除该记录"
                className="absolute top-1 right-1 z-10 flex size-5 items-center justify-center rounded-full bg-white/90 text-muted-foreground shadow border border-border hover:text-destructive"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
