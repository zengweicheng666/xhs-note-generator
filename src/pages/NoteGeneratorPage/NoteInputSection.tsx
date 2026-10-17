import { useCallback, type FormEvent, type KeyboardEvent } from 'react';
import { Shuffle, Sparkles, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NOTE_STYLES, TOPIC_KEYWORDS } from '@/data/note';
import { cn } from '@/lib/utils';

export const MAX_IMAGE_COUNT = 4;
export const MAX_TEXT_LENGTH = 1000;
export const MIN_TEXT_LENGTH = 100;
export const DEFAULT_TEXT_LENGTH = 300;

interface NoteInputSectionProps {
  onGenerate: (keyword: string) => void;
  isLoading: boolean;
  onCancel?: () => void;
  /** 输入框内容（受控，便于切换历史记录时把主题回填到输入框） */
  keyword: string;
  onKeywordChange: (value: string) => void;
  imageCount: number;
  onImageCountChange: (n: number) => void;
  textLength: number;
  onTextLengthChange: (n: number) => void;
  /** 当前选择的配图风格 id */
  styleId: string;
  onStyleChange: (id: string) => void;
}

export default function NoteInputSection({
  onGenerate,
  isLoading,
  onCancel,
  keyword,
  onKeywordChange,
  imageCount,
  onImageCountChange,
  textLength,
  onTextLengthChange,
  styleId,
  onStyleChange,
}: NoteInputSectionProps) {
  const setKeyword = onKeywordChange;

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
    const random = TOPIC_KEYWORDS[Math.floor(Math.random() * TOPIC_KEYWORDS.length)];
    setKeyword(random);
    if (!isLoading) {
      onGenerate(random);
    }
  }, [isLoading, onGenerate, setKeyword]);

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
            placeholder="输入一个主题关键词，比如：穿搭、美食、旅行..."
            className="h-12 text-base pl-4 pr-4 bg-white"
            disabled={isLoading}
          />
        </div>
        <div className="flex gap-2">
          {isLoading ? (
            <Button
              type="button"
              variant="outline"
              className="h-12 px-6 shrink-0"
              onClick={onCancel}
            >
              取消
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleRandom}
              disabled={isLoading}
              className="h-12 w-12 shrink-0"
              title="随机一个主题"
            >
              <Shuffle className="size-4" />
            </Button>
          )}
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

      {/* 生图数量控制 */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-muted-foreground shrink-0">生图数量</span>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-white px-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => onImageCountChange(Math.max(1, imageCount - 1))}
            disabled={isLoading || imageCount <= 1}
            title="减少一张"
          >
            <Minus className="size-4" />
          </Button>
          <span className="w-6 text-center text-sm font-medium tabular-nums">{imageCount}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => onImageCountChange(Math.min(MAX_IMAGE_COUNT, imageCount + 1))}
            disabled={isLoading || imageCount >= MAX_IMAGE_COUNT}
            title="增加一张"
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <span className="text-xs text-muted-foreground/70">（默认 1 张，最多 {MAX_IMAGE_COUNT} 张）</span>
      </div>

      {/* 正文字数控制 */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-muted-foreground shrink-0">正文字数</span>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-white px-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => onTextLengthChange(Math.max(MIN_TEXT_LENGTH, textLength - 50))}
            disabled={isLoading || textLength <= MIN_TEXT_LENGTH}
            title="减少 50 字"
          >
            <Minus className="size-4" />
          </Button>
          <span className="w-14 text-center text-sm font-medium tabular-nums">{textLength}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => onTextLengthChange(Math.min(MAX_TEXT_LENGTH, textLength + 50))}
            disabled={isLoading || textLength >= MAX_TEXT_LENGTH}
            title="增加 50 字"
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <span className="text-xs text-muted-foreground/70">（{MIN_TEXT_LENGTH}–{MAX_TEXT_LENGTH} 字，默认 {DEFAULT_TEXT_LENGTH} 字）</span>
      </div>

      {/* 配图风格选择 */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm text-muted-foreground shrink-0">配图风格</span>
          <span className="text-xs text-muted-foreground/70">
            （共 {NOTE_STYLES.length} 种，当前：{NOTE_STYLES.find((s) => s.id === styleId)?.label ?? NOTE_STYLES[0].label}）
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {NOTE_STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => onStyleChange(style.id)}
              disabled={isLoading}
              title={style.prompt}
              className={cn(
                'px-3 py-1.5 text-sm rounded-full border transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                style.id === styleId
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-border bg-card hover:border-primary/40 hover:bg-primary/5',
              )}
            >
              {style.label}
            </button>
          ))}
        </div>
      </div>

      {/* 主题快捷标签 */}
      <div className="flex flex-wrap gap-2">
        {TOPIC_KEYWORDS.slice(0, 10).map((topic) => (
          <button
            key={topic}
            type="button"
            onClick={() => {
              setKeyword(topic);
              if (!isLoading) onGenerate(topic);
            }}
            disabled={isLoading}
            className={cn(
              'px-3 py-1.5 text-sm rounded-full border border-border bg-card',
              'hover:border-primary/40 hover:bg-primary/5 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {topic}
          </button>
        ))}
      </div>
    </div>
  );
}
