import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '@lark-apaas/client-toolkit-lite';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import NoteInputSection, { DEFAULT_TEXT_LENGTH } from './NoteInputSection';
import NoteResultCard from './NoteResultCard';
import HistorySection from './HistorySection';
import SettingsDialog from './SettingsDialog';
import { useNoteHistory } from '@/hooks/use-note-history';
import {
  DEFAULT_STYLE_ID,
  LOCAL_PRESETS,
  recordImages,
  type INoteRecord,
} from '@/data/note';
import { generateImage, generateNote, regenerateImage } from '@/lib/ark';
import { createPlaceholderImage } from '@/lib/image-composer';

type GenerateStage = 'idle' | 'image' | 'text' | 'done';

// 在本地 dev 环境 AI 文案不可用时，按关键词挑一条示例文案兜底
function pickLocalPreset(keyword: string) {
  const kw = keyword.trim();
  const hit = LOCAL_PRESETS.find(p =>
    p.keywords.some(k => kw.includes(k) || k.includes(kw)),
  );
  const picked = hit || LOCAL_PRESETS[Math.floor(Math.random() * LOCAL_PRESETS.length)];
  return {
    title: picked.title,
    caption: picked.caption,
    tags: picked.tags,
  };
}

export default function NoteGeneratorPage() {
  const { history, addRecord, updateRecord, deleteRecord, clearHistory } = useNoteHistory();
  const [currentRecord, setCurrentRecord] = useState<INoteRecord | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [stage, setStage] = useState<GenerateStage>('idle');
  const [currentKeyword, setCurrentKeyword] = useState('');
  const [imageCount, setImageCount] = useState(1);
  const [textLength, setTextLength] = useState(DEFAULT_TEXT_LENGTH);
  const [styleId, setStyleId] = useState(DEFAULT_STYLE_ID);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [isOfflineCaption, setIsOfflineCaption] = useState(false);

  // 统一忙碌状态：整条生成 或 单张重生成 进行中
  const isBusy = isGenerating || regeneratingIndex !== null;

  const abortRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const recordIdRef = useRef<string | null>(null);

  useEffect(() => {
    recordIdRef.current = currentRecord?.id ?? null;
  }, [currentRecord?.id]);

  const generateNoteAction = useCallback(
    async (keyword: string) => {
      if (!keyword.trim() || isBusy) return;

      const trimmed = keyword.trim();
      const count = imageCount;
      setCurrentKeyword(trimmed);
      setIsGenerating(true);
      setStage('image');
      setCurrentRecord(null);
      setIsOfflineCaption(false);
      abortRef.current = false;
      const controller = new AbortController();
      abortControllerRef.current = controller;

      let imageUrls: string[] = [];
      let title = '';
      let titles: string[] = [];
      let caption = '';
      let tags: string[] = [];

      try {
        // 图、文并行，互不拖累：图失败用占位图兜底，文案失败用本地文案兜底
        const [imgRes, noteRes] = await Promise.allSettled([
          generateImage(trimmed, count, controller.signal, styleId),
          generateNote(trimmed, textLength, controller.signal),
        ]);
        // 用户已取消，丢弃结果
        if (abortRef.current) {
          setIsGenerating(false);
          setStage('idle');
          return;
        }
        setStage('text');
        const local = pickLocalPreset(trimmed);

        if (imgRes.status === 'fulfilled') {
          imageUrls = imgRes.value;
          if (imageUrls.length < count) {
            toast.message(`已生成 ${imageUrls.length} 张，其余 ${count - imageUrls.length} 张失败`);
          }
        } else {
          logger.warn('文生图不可用，使用占位配图:', String(imgRes.reason));
        }

        // 整批生图都失败时，用一张占位图兜底，避免卡片空白
        if (imageUrls.length === 0) {
          imageUrls = [await createPlaceholderImage(trimmed)];
        }

        if (noteRes.status === 'fulfilled') {
          title = noteRes.value.title;
          titles = noteRes.value.titles;
          caption = noteRes.value.content;
          tags = noteRes.value.tags;
        } else {
          logger.warn('文案模型不可用，使用本地示例文案:', String(noteRes.reason));
          title = local.title;
          titles = [local.title];
          caption = local.caption.slice(0, textLength);
          tags = local.tags;
          setIsOfflineCaption(true);
        }

        const record: INoteRecord = {
          id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          keyword: trimmed,
          imageUrls,
          title: title || `关于${trimmed}的图文笔记`,
          titles: titles.length > 0 ? titles : [title || `关于${trimmed}的图文笔记`],
          caption: caption || '今天也要认真生活，把喜欢的事记录下来～',
          tags: tags.length > 0 ? tags : ['图文笔记', '小红书', trimmed],
          createdAt: Date.now(),
          styleId,
        };

        setCurrentRecord(record);
        addRecord(record);
        setStage('done');
      } catch (error) {
        if (abortRef.current) {
          // 主动取消，不报错
        } else {
          logger.error('生成失败:', String(error));
          toast.error('生成失败，请稍后重试');
        }
      } finally {
        setIsGenerating(false);
      }
    },
    [isBusy, addRecord, imageCount, textLength, styleId],
  );

  // 取消当前生成
  const handleCancel = useCallback(() => {
    abortRef.current = true;
    abortControllerRef.current?.abort();
    setIsGenerating(false);
    setStage('idle');
  }, []);

  const handleRegenerate = useCallback(() => {
    if (currentKeyword && !isBusy) {
      generateNoteAction(currentKeyword);
    }
  }, [currentKeyword, isBusy, generateNoteAction]);

  // 单独重新生成某一张配图：只替换该索引的图，文案与其它图不动
  const handleRegenerateImage = useCallback(
    async (index: number) => {
      if (!currentRecord || regeneratingIndex !== null) return;
      const prevImages = recordImages(currentRecord);
      if (index < 0 || index >= prevImages.length) return;
      const startId = currentRecord.id;

      setRegeneratingIndex(index);
      try {
        // 沿用该记录生成时的风格，保证重生成与原有配图风格一致
        const newUrl = await regenerateImage(currentRecord.keyword, currentRecord.styleId ?? styleId);
        // 重生成期间若用户已切换到其它记录，则丢弃本次结果，避免覆盖错误记录
        if (recordIdRef.current !== startId) return;
        const nextImages = prevImages.slice();
        nextImages[index] = newUrl;
        const nextRecord: INoteRecord = { ...currentRecord, imageUrls: nextImages };
        setCurrentRecord(nextRecord);
        updateRecord(nextRecord);
        toast.success(`第 ${index + 1} 张已重新生成`);
      } catch (error) {
        logger.error('单张重新生成失败:', String(error));
        toast.error('重新生成失败，请稍后重试');
      } finally {
        setRegeneratingIndex(null);
      }
    },
    [currentRecord, regeneratingIndex, updateRecord, styleId],
  );

  const handleSelectHistory = useCallback(
    (record: INoteRecord) => {
      if (isBusy) return; // 生成/重生成进行中禁止切换，避免状态错乱
      setCurrentRecord(record);
      setCurrentKeyword(record.keyword);
    },
    [isBusy],
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/60 via-background to-background">
      <main className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-16 space-y-10">
        {/* 右上角设置入口 */}
        <div className="flex justify-end">
          <SettingsDialog />
        </div>

        {/* 标题区 */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <Sparkles className="size-4" />
            通用图文笔记生成器
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            一键生成你的小红书图文笔记
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            输入一个主题关键词，AI 生成配图 + 文案 + 标题标签，可直接下载发布
          </p>
        </div>

        {/* 输入控制区 */}
        <section className="w-full">
          <NoteInputSection
            onGenerate={generateNoteAction}
            isLoading={isBusy}
            onCancel={handleCancel}
            initialKeyword={currentKeyword}
            imageCount={imageCount}
            onImageCountChange={setImageCount}
            textLength={textLength}
            onTextLengthChange={setTextLength}
            styleId={styleId}
            onStyleChange={setStyleId}
          />
        </section>

        {/* 结果展示区 */}
        <section className="w-full">
          <NoteResultCard
            record={currentRecord}
            isGenerating={isGenerating}
            stage={stage}
            onRegenerate={handleRegenerate}
            onRegenerateImage={handleRegenerateImage}
            regeneratingIndex={regeneratingIndex}
            isOfflineCaption={isOfflineCaption}
          />
        </section>

        {/* 历史记录区 */}
        <section className="w-full">
          <HistorySection
            history={history}
            onSelect={handleSelectHistory}
            onDelete={deleteRecord}
            onClear={clearHistory}
            selectedId={currentRecord?.id}
          />
        </section>

        {/* 底部说明 */}
        <footer className="text-center text-xs text-muted-foreground/60 pt-4">
          <p>📝 通用图文笔记 · AI 生成 · 仅供参考</p>
        </footer>
      </main>
    </div>
  );
}
