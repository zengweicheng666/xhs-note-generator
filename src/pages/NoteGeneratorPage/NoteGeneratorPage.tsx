import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '@lark-apaas/client-toolkit-lite';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import NoteInputSection, {
  DEFAULT_TEXT_LENGTH,
  MAX_IMAGE_COUNT,
  MAX_TEXT_LENGTH,
  MIN_TEXT_LENGTH,
} from './NoteInputSection';
import NoteResultCard from './NoteResultCard';
import HistorySection from './HistorySection';
import SettingsDialog from './SettingsDialog';
import { useNoteHistory } from '@/hooks/use-note-history';
import {
  DEFAULT_STYLE_ID,
  LOCAL_PRESETS,
  makeNoteLabel,
  nextSeqForDay,
  recordImages,
  type INoteRecord,
} from '@/data/note';
import { generateImage, generateNote, regenerateImage } from '@/lib/ark';
import { createPlaceholderImage } from '@/lib/image-composer';
import { persistImage, persistImages } from '@/lib/image-store';

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
  // 配图已失效的记录 id 集合（由历史列表的图片加载失败上报）
  const [expiredIds, setExpiredIds] = useState<Record<string, boolean>>({});

  // 统一忙碌状态：整条生成 或 单张重生成 进行中
  const isBusy = isGenerating || regeneratingIndex !== null;

  // 编号在创建时已固定写入记录，直接读取即可（删除其它记录不会重排）
  const currentLabel = currentRecord
    ? makeNoteLabel(currentRecord.createdAt, currentRecord.seq)
    : '';

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

        // 主题描述可能很长，文件名与历史标题统一用「日期 + 当日编号」
        // 编号在创建时固定下来：取同日已有最大编号 +1，删除记录不会导致重排或复用
        const now = Date.now();
        const seq = nextSeqForDay(history, now);

        // 方舟图片链接只有 24 小时有效期，这里转存到工程 public/notes/ 目录，
        // 历史记录里用稳定的本地 URL，避免隔天图片全部失效
        imageUrls = await persistImages(imageUrls, `图文笔记_${makeNoteLabel(now, seq)}`);

        const record: INoteRecord = {
          id: `note_${now}_${Math.random().toString(36).slice(2, 8)}`,
          keyword: trimmed,
          imageUrls,
          title: title || `关于${trimmed}的图文笔记`,
          titles: titles.length > 0 ? titles : [title || `关于${trimmed}的图文笔记`],
          caption: caption || '今天也要认真生活，把喜欢的事记录下来～',
          tags: tags.length > 0 ? tags : ['图文笔记', '小红书', trimmed],
          createdAt: now,
          styleId,
          imageCount: count,
          textLength,
          seq,
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
    [isBusy, addRecord, imageCount, textLength, styleId, history],
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
        // 同样转存到本地目录，避免新图 24 小时后失效
        const savedUrl = await persistImage(
          newUrl,
          `图文笔记_${makeNoteLabel(currentRecord.createdAt, currentRecord.seq)}_${index + 1}`,
        );
        const nextImages = prevImages.slice();
        nextImages[index] = savedUrl ?? newUrl;
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

      // 把该记录的三个生成参数回写到控件（旧记录缺字段时按内容兜底）
      const restoredCount = record.imageCount ?? (recordImages(record).length || 1);
      setImageCount(Math.min(Math.max(1, restoredCount), MAX_IMAGE_COUNT));

      const fallbackLen = record.caption ? record.caption.length : textLength;
      const restoredLen = record.textLength ?? fallbackLen;
      setTextLength(Math.min(Math.max(MIN_TEXT_LENGTH, restoredLen), MAX_TEXT_LENGTH));

      setStyleId(record.styleId ?? DEFAULT_STYLE_ID);

      // 该记录的文案是否为离线兜底，随记录一起切换展示
      setIsOfflineCaption(false);
    },
    [isBusy, textLength],
  );

  // 批量重新生成失效的历史配图（原图已过期为唯一可行方案，生成的新图会自动落盘）
  const [regeneratingExpired, setRegeneratingExpired] = useState(false);
  const handleRegenerateExpired = useCallback(async () => {
    if (isBusy || regeneratingExpired) return;
    const targets = history.filter((r) => {
      const urls = recordImages(r);
      // 本地占位图（data:）不是失效；其余非 /notes/ 的远程图视为可能失效，
      // 以 HistorySection 上报的加载失败为准（见 expiredIds）
      return expiredIds[r.id] && urls.length > 0;
    });
    if (targets.length === 0) return;

    setRegeneratingExpired(true);
    let okCount = 0;
    let failCount = 0;
    try {
      for (const record of targets) {
        const urls = recordImages(record);
        const nextImages = [...urls];
        let recordOk = true;
        for (let i = 0; i < urls.length; i++) {
          try {
            // 用原主题 + 原风格重新生成，尽量贴近原记录
            const fresh = await regenerateImage(record.keyword, record.styleId ?? styleId);
            const saved = await persistImage(
              fresh,
              `图文笔记_${makeNoteLabel(record.createdAt, record.seq)}_${i + 1}`,
            );
            nextImages[i] = saved ?? fresh;
          } catch (error) {
            recordOk = false;
            logger.warn(`重新生成「${record.keyword}」第 ${i + 1} 张失败:`, String(error));
          }
        }
        if (recordOk) okCount += 1;
        else failCount += 1;
        // 仅当该记录仍是当前展示的记录时，同步刷新右侧卡片
        if (recordIdRef.current === record.id) {
          setCurrentRecord((prev) =>
            prev && prev.id === record.id ? { ...prev, imageUrls: nextImages, imageUrl: nextImages[0] } : prev,
          );
        }
        updateRecord({ ...record, imageUrls: nextImages, imageUrl: nextImages[0] });
      }
      if (okCount > 0) toast.success(`已重新生成 ${okCount} 条记录的配图，并保存到本地目录`);
      if (failCount > 0) toast.error(`${failCount} 条记录生成失败（可能是额度不足），可稍后再试`);
      setExpiredIds({});
    } finally {
      setRegeneratingExpired(false);
    }
  }, [isBusy, regeneratingExpired, history, expiredIds, styleId, updateRecord]);

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
            keyword={currentKeyword}
            onKeywordChange={setCurrentKeyword}
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
            noteLabel={currentLabel}
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
            onExpiredIdsChange={setExpiredIds}
            onRegenerateExpired={handleRegenerateExpired}
            regeneratingExpired={regeneratingExpired}
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
