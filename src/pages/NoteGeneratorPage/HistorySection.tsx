import { useMemo } from 'react';
import { Image } from '@/components/ui/image';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { buildNoteLabels, recordImages, type INoteRecord } from '@/data/note';

interface HistorySectionProps {
  history: INoteRecord[];
  onSelect: (record: INoteRecord) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  selectedId?: string;
}

export default function HistorySection({
  history,
  onSelect,
  onDelete,
  onClear,
  selectedId,
}: HistorySectionProps) {
  // 「日期+编号」由记录集合推导，同日编号唯一（旧记录也能补上正确编号）
  const labels = useMemo(() => buildNoteLabels(history), [history]);

  if (history.length === 0) return null;

  const handleClear = () => {
    if (window.confirm('确定清空全部历史记录？')) onClear();
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-foreground">最近生成</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{history.length} 条</span>
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
                  <Image
                    src={recordImages(record)[0] || ''}
                    alt={record.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-[96px] truncate">
                  {labels.get(record.id)}
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
