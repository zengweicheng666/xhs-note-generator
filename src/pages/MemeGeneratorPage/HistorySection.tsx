import { Image } from '@/components/ui/image';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import type { IMemeRecord } from '@/data/meme';

interface HistorySectionProps {
  history: IMemeRecord[];
  onSelect: (record: IMemeRecord) => void;
  selectedId?: string;
}

export default function HistorySection({ history, onSelect, selectedId }: HistorySectionProps) {
  if (history.length === 0) return null;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-foreground">最近生成</h3>
        <span className="text-xs text-muted-foreground">{history.length} 条</span>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-2">
          {history.map((record) => (
            <button
              key={record.id}
              onClick={() => onSelect(record)}
              className="shrink-0 group"
            >
              <div
                className="w-24 h-32 rounded-lg overflow-hidden border-2 transition-all bg-muted"
                style={{
                  borderColor: selectedId === record.id ? 'hsl(22 60% 45%)' : 'transparent',
                }}
              >
                <Image
                  src={record.imageUrl}
                  alt={record.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-[96px] truncate">
                {record.keyword}
              </p>
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
