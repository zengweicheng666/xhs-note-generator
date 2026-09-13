import { useState, useCallback, type FormEvent, type KeyboardEvent } from 'react';
import { Shuffle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MOOD_KEYWORDS } from '@/data/meme';
import { cn } from '@/lib/utils';

interface MemeInputSectionProps {
  onGenerate: (keyword: string) => void;
  isLoading: boolean;
  initialKeyword?: string;
}

export default function MemeInputSection({
  onGenerate,
  isLoading,
  initialKeyword = '',
}: MemeInputSectionProps) {
  const [keyword, setKeyword] = useState(initialKeyword);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const trimmed = keyword.trim();
      if (!trimmed || isLoading) return;
      onGenerate(trimmed);
    },
    [keyword, isLoading, onGenerate],
  );

  const handleRandom = useCallback(() => {
    const random = MOOD_KEYWORDS[Math.floor(Math.random() * MOOD_KEYWORDS.length)];
    setKeyword(random);
    if (!isLoading) {
      onGenerate(random);
    }
  }, [isLoading, onGenerate]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const trimmed = keyword.trim();
        if (trimmed && !isLoading) {
          onGenerate(trimmed);
        }
      }
    },
    [keyword, isLoading, onGenerate],
  );

  return (
    <div className="w-full">
      {/* 搜索输入框 + 按钮 */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1 relative">
          <Input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入一个情绪关键词，比如：加班、周一、穷..."
            className="h-12 text-base pl-4 pr-4 bg-white"
            disabled={isLoading}
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleRandom}
            disabled={isLoading}
            className="h-12 w-12 shrink-0"
            title="随机一个情绪"
          >
            <Shuffle className="size-4" />
          </Button>
          <Button
            type="submit"
            disabled={isLoading || !keyword.trim()}
            className="h-12 px-6 shrink-0"
          >
            <Sparkles className="size-4 mr-2" />
            生成笔记
          </Button>
        </div>
      </form>

      {/* 情绪快捷标签 */}
      <div className="flex flex-wrap gap-2">
        {MOOD_KEYWORDS.slice(0, 10).map((mood) => (
          <button
            key={mood}
            type="button"
            onClick={() => {
              setKeyword(mood);
              if (!isLoading) onGenerate(mood);
            }}
            disabled={isLoading}
            className={cn(
              'px-3 py-1.5 text-sm rounded-full border border-border bg-card',
              'hover:border-primary/40 hover:bg-primary/5 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {mood}
          </button>
        ))}
      </div>
    </div>
  );
}
