import { useState, useCallback } from 'react';
import { capabilityClient, logger } from '@lark-apaas/client-toolkit-lite';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import MemeInputSection from './MemeInputSection';
import MemeResultCard from './MemeResultCard';
import HistorySection from './HistorySection';
import { useMemeHistory } from '@/hooks/use-meme-history';
import type { IMemeRecord } from '@/data/meme';

const IMAGE_PLUGIN_ID = 'jokebear_image_generator_1';
const TEXT_PLUGIN_ID = 'self_deprecating_bear_note_generator_1';

type GenerateStage = 'idle' | 'image' | 'text' | 'done';

export default function MemeGeneratorPage() {
  const { history, addRecord } = useMemeHistory();
  const [currentRecord, setCurrentRecord] = useState<IMemeRecord | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [stage, setStage] = useState<GenerateStage>('idle');
  const [currentKeyword, setCurrentKeyword] = useState('');

  const generateMeme = useCallback(
    async (keyword: string) => {
      if (!keyword.trim() || isGenerating) return;

      const trimmed = keyword.trim();
      setCurrentKeyword(trimmed);
      setIsGenerating(true);
      setStage('image');
      setCurrentRecord(null);

      let imageUrl = '';
      let title = '';
      let caption = '';
      let tags: string[] = [];

      try {
        // 并行生成图片和文案
        const imagePromise = (async () => {
          const executor = (capabilityClient as any).load(IMAGE_PLUGIN_ID);
          const result = await (executor as any).call('textToImage', {
            emotion_keyword: trimmed,
            image_ratio: '3:4',
          });
          if (result?.images?.[0]) {
            imageUrl = result.images[0];
          } else {
            throw new Error('图片生成失败');
          }
        })();

        setStage('image');

        const textPromise = (async () => {
          const executor = (capabilityClient as any).load(TEXT_PLUGIN_ID);
          const result = await (executor as any).call('textToJson', {
            emotion_keyword: trimmed,
          });
          title = result?.title || '';
          caption = result?.content || '';
          if (Array.isArray(result?.tags)) {
            tags = result.tags
              .map((t: any) => (typeof t === 'string' ? t : t?.tag || ''))
              .filter(Boolean);
          }
        })();

        // 等两个都完成
        await Promise.all([imagePromise, textPromise]);
        setStage('text');

        if (!imageUrl) {
          throw new Error('图片生成失败');
        }

        const record: IMemeRecord = {
          id: `meme_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          keyword: trimmed,
          imageUrl,
          title: title || `关于${trimmed}的自嘲熊表情包`,
          caption: caption || '今天也是被生活拿捏的一天...',
          tags: tags.length > 0 ? tags : ['自嘲熊', '打工人', '表情包'],
          createdAt: Date.now(),
        };

        setCurrentRecord(record);
        addRecord(record);
        setStage('done');
      } catch (error) {
        logger.error('生成失败:', String(error));
        toast.error('生成失败，请稍后重试');
      } finally {
        setIsGenerating(false);
      }
    },
    [isGenerating, addRecord],
  );

  const handleRegenerate = useCallback(() => {
    if (currentKeyword) {
      generateMeme(currentKeyword);
    }
  }, [currentKeyword, generateMeme]);

  const handleSelectHistory = useCallback((record: IMemeRecord) => {
    setCurrentRecord(record);
    setCurrentKeyword(record.keyword);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/60 via-background to-background">
      <main className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-16 space-y-10">
        {/* 标题区 */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <Sparkles className="size-4" />
            自嘲熊表情包生成器
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            打工人专属表情包笔记
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            输入一个情绪关键词，AI 生成自嘲熊风格配图 + 扎心文案 + 小红书标题标签
          </p>
        </div>

        {/* 输入控制区 */}
        <section className="w-full">
          <MemeInputSection
            onGenerate={generateMeme}
            isLoading={isGenerating}
            initialKeyword={currentKeyword}
          />
        </section>

        {/* 结果展示区 */}
        <section className="w-full">
          <MemeResultCard
            record={currentRecord}
            isGenerating={isGenerating}
            stage={stage}
            onRegenerate={handleRegenerate}
          />
        </section>

        {/* 历史记录区 */}
        <section className="w-full">
          <HistorySection
            history={history}
            onSelect={handleSelectHistory}
            selectedId={currentRecord?.id}
          />
        </section>

        {/* 底部说明 */}
        <footer className="text-center text-xs text-muted-foreground/60 pt-4">
          <p>🐻 自嘲熊风格 · AI 生成 · 仅供娱乐</p>
        </footer>
      </main>
    </div>
  );
}
