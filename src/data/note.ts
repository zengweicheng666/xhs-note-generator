// EXPORTS: INoteRecord, TOPIC_KEYWORDS, NOTE_STYLES, DEFAULT_STYLE_ID, getStylePrompt

export interface INoteRecord {
  id: string;
  keyword: string;
  /** 生成的配图数组（可多张）；默认 1 张 */
  imageUrls: string[];
  /** 历史兼容：旧记录只有单张图时保留 */
  imageUrl?: string;
  title: string;
  titles?: string[];
  caption: string;
  tags: string[];
  createdAt: number;
  /** 生成配图时使用的风格 id（重生成时沿用，保证风格一致；旧记录可能没有） */
  styleId?: string;
  /** 生成时选择的生图数量（切换历史时回写，旧记录没有） */
  imageCount?: number;
  /** 生成时选择的正文目标字数（切换历史时回写，旧记录没有） */
  textLength?: number;
  /**
   * 当日编号（从 1 开始），与日期一起组成「日期+编号」短标签。
   * 创建时即固定写入记录：删除其它记录不会导致编号重排，编号也不会被复用。
   */
  seq?: number;
}

/** 日期戳：YYYYMMDD */
export function formatDateStamp(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

/**
 * 「日期 + 当日编号」短标签，如 20261017_001。
 * 用户输入的主题描述可能很长，不适合直接做文件名或历史标题，统一用这个短标签。
 */
export function makeNoteLabel(createdAt: number, seq = 1): string {
  return `${formatDateStamp(createdAt)}_${String(Math.max(1, seq)).padStart(3, '0')}`;
}

/**
 * 计算新记录在当日应使用的编号：取同日已有编号的最大值 + 1。
 *
 * 用「最大值 + 1」而不是「条数 + 1」，这样删除记录后编号不会被复用、也不会重排，
 * 新记录永远接在当日已用过的最大编号之后。
 */
export function nextSeqForDay(records: INoteRecord[], createdAt: number): number {
  const stamp = formatDateStamp(createdAt);
  let max = 0;
  for (const record of records) {
    if (formatDateStamp(record.createdAt) !== stamp) continue;
    const seq = typeof record.seq === 'number' && record.seq > 0 ? record.seq : 0;
    if (seq > max) max = seq;
  }
  return max + 1;
}

/**
 * 为缺少 seq 的旧记录一次性补编号（按同日 createdAt 升序，接在当日已有最大编号之后）。
 * 补齐后编号就固定下来，后续增删不会再变化。
 */
export function backfillSeq(records: INoteRecord[]): {
  records: INoteRecord[];
  changed: boolean;
} {
  const missing = records.filter((r) => typeof r.seq !== 'number' || r.seq <= 0);
  if (missing.length === 0) return { records, changed: false };

  // 先记录各日已使用的最大编号
  const counters = new Map<string, number>();
  for (const record of records) {
    if (typeof record.seq === 'number' && record.seq > 0) {
      const stamp = formatDateStamp(record.createdAt);
      counters.set(stamp, Math.max(counters.get(stamp) ?? 0, record.seq));
    }
  }

  const ordered = [...missing].sort(
    (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
  );
  const assigned = new Map<string, number>();
  for (const record of ordered) {
    const stamp = formatDateStamp(record.createdAt);
    const next = (counters.get(stamp) ?? 0) + 1;
    counters.set(stamp, next);
    assigned.set(record.id, next);
  }

  return {
    records: records.map((r) => {
      const seq = assigned.get(r.id);
      return seq ? { ...r, seq } : r;
    }),
    changed: true,
  };
}

/** 配图风格：用户可在界面选择，prompt 片段会拼进文生图提示词 */
export interface INoteStyle {
  id: string;
  label: string;
  /** 拼接进提示词的风格描述 */
  prompt: string;
}

// 可选的配图风格列表（背景统一保持纯白，保证首次生成与重生成、多张之间风格一致）
export const NOTE_STYLES: INoteStyle[] = [
  { id: 'fresh', label: '极简清新', prompt: '极简清新插画风格' },
  { id: 'cartoon', label: '卡通手绘', prompt: '可爱卡通手绘风格' },
  { id: 'clay', label: '3D 黏土', prompt: '3D 黏土盲盒风格，立体质感、柔和建模光' },
  { id: 'watercolor', label: '水彩', prompt: '柔和清新水彩画风格，纸纹质感' },
  { id: 'flat', label: '扁平插画', prompt: '现代扁平矢量插画风格，色块简洁' },
  { id: 'lineart', label: '极简线条', prompt: '极简线条插画风格，单色勾线、大量留白' },
  { id: 'guochao', label: '复古国潮', prompt: '复古国潮插画风格，传统纹样与配色' },
  { id: 'morandi', label: '莫兰迪', prompt: '莫兰迪低饱和度插画风格，高级灰配色' },
  { id: 'photo', label: '写实摄影', prompt: '真实摄影风格，柔和自然光、浅景深' },
  { id: 'film', label: '日系胶片', prompt: '日系胶片摄影风格，柔和颗粒感' },
];

export const DEFAULT_STYLE_ID = 'fresh';

/** 按 id 取风格描述片段，未知 id 回退到默认风格 */
export function getStylePrompt(id?: string): string {
  const hit = NOTE_STYLES.find((s) => s.id === id);
  return hit ? hit.prompt : NOTE_STYLES[0].prompt;
}

/** 按 id 取风格显示名 */
export function getStyleLabel(id?: string): string {
  const hit = NOTE_STYLES.find((s) => s.id === id);
  return hit ? hit.label : NOTE_STYLES[0].label;
}

/** 取记录的配图数组，兼容只有 imageUrl 的旧记录 */
export function recordImages(record: INoteRecord): string[] {
  if (record.imageUrls && record.imageUrls.length > 0) return record.imageUrls;
  return record.imageUrl ? [record.imageUrl] : [];
}

// 主题快捷标签：覆盖常见的图文笔记选题方向
export const TOPIC_KEYWORDS = [
  '穿搭',
  '美食',
  '旅行',
  '护肤',
  '健身',
  '读书',
  '家居',
  '摄影',
  '职场',
  '宠物',
  '咖啡',
  '减脂',
  '副业',
  '好物',
  '自律',
];

// 本地离线预设：当 AI 文案模型不可用时（如纯本地 dev 环境），按关键词匹配返回示例文案
// 配图统一在页面侧用占位图兜底，不再依赖特定主题素材
export interface ILocalPreset {
  keywords: string[];
  title: string;
  caption: string;
  tags: string[];
}

export const LOCAL_PRESETS: ILocalPreset[] = [
  {
    keywords: ['穿搭', '时尚', '搭配', 'ootd', '通勤'],
    title: '普通人也能直接抄的秋季通勤穿搭',
    caption:
      '不追爆款，只追适合自己。通勤穿搭最怕用力过猛，其实三件基础单品就能撑起一整周。\n\n' +
      '① 上装选一件米白针织，贴肤不扎，单穿叠穿都成立\n\n' +
      '② 下装换直筒深灰西裤，比紧身裤显腿直，也藏得住久坐的小肚子\n\n' +
      '③ 鞋子穿乐福鞋，比运动鞋正式、比高跟鞋舒服，走一天也不累\n\n' +
      '全身颜色控制在三个以内，高级感基本就有了。',
    tags: ['穿搭', '通勤OOTD', '基础款'],
  },
  {
    keywords: ['美食', '探店', '做饭', '食谱', '下午茶'],
    title: '在家也能复刻的治愈系早餐',
    caption:
      '十分钟搞定一顿好看又好吃的早午餐，比下楼排队划算太多。\n\n' +
      '① 吐司烤 3 分钟到微焦，抹一层牛油果泥，撒点黑胡椒\n\n' +
      '② 煎蛋用小火盖盖焖 1 分钟，溏心蛋黄刚好不会流得到处都是\n\n' +
      '③ 配一杯热牛奶或手冲，杯子先预热过会更香\n\n' +
      '摆盘别贪多，留白反而更出片。好好吃早饭，是成本最低的自愈。',
    tags: ['美食', '居家食谱', '早餐'],
  },
  {
    keywords: ['旅行', '出游', '攻略', '周末', 'citywalk'],
    title: '不用请假的小众城市漫步路线',
    caption:
      '周末不想人挤人，又想换个地方透透气，这条路线可以直接抄。\n\n' +
      '① 上午从老城区巷口开始，人少光线好，随手拍都是空景\n\n' +
      '② 中午拐进社区小馆，比网红店便宜一半，还不用排队\n\n' +
      '③ 下午沿河走到书店或咖啡馆，坐下来发会儿呆\n\n' +
      '全程不赶景点，走到哪算哪，这才是周末该有的节奏。',
    tags: ['旅行', 'Citywalk', '周末去哪'],
  },
  {
    keywords: ['护肤', '化妆', '好物', '平价', '敏感肌'],
    title: '敏感肌亲测好用的极简护肤思路',
    caption:
      '皮肤反复泛红那阵子，我把护肤从七步砍到三步，状态反而稳了。\n\n' +
      '① 清洁只用氨基酸洁面，早晚各一次，水温别超过体温\n\n' +
      '② 保湿选成分简单的面霜，含神经酰胺的对屏障更友好\n\n' +
      '③ 白天一定防晒，敏感肌优先物理防晒，刺激更小\n\n' +
      '功效类产品一次只加一样，给皮肤两周观察期，别急着叠加。',
    tags: ['护肤', '敏感肌', '极简护肤'],
  },
  {
    keywords: ['健身', '减脂', '运动', '瑜伽', '自律'],
    title: '新手也能坚持的居家运动计划',
    caption:
      '不办卡、不买器械，每天二十分钟，零基础也能跟下来。\n\n' +
      '① 前 5 分钟热身：开合跳加转肩，把关节先活动开\n\n' +
      '② 中间 12 分钟循环：深蹲 15 个、跪姿俯卧撑 10 个、平板支撑 30 秒，做 3 轮\n\n' +
      '③ 最后 3 分钟拉伸，重点放松大腿前侧和腰背\n\n' +
      '别一上来就拼强度，能连续做满两周，已经赢过大多数人。',
    tags: ['健身', '居家运动', '自律'],
  },
  {
    keywords: ['读书', '书单', '成长', '自我提升'],
    title: '今年让我反复回味的几本书',
    caption:
      '读书是成本最低的见世面，挑对书比读得多更重要。\n\n' +
      '① 一本文学类，用来找回感受力和共情能力\n\n' +
      '② 一本认知类，帮你看懂自己为什么总在原地打转\n\n' +
      '③ 一本实用类，读完就能立刻用在工作或生活里\n\n' +
      '三类交叉着读不容易腻，理解还会互相打通。每天二十页，一年下来很可观。',
    tags: ['读书', '书单分享', '自我提升'],
  },
  {
    keywords: ['家居', '租房', '收纳', '布置', '好物'],
    title: '小出租屋也能拥有的治愈角落',
    caption:
      '不砸墙不翻修，三样东西就能把出租屋变成下班想回的地方。\n\n' +
      '① 灯光换成暖光，主灯太冷就加一盏落地灯，氛围立刻不一样\n\n' +
      '② 铺一块地毯划定休息区，视觉上做了分区，也更适合席地而坐\n\n' +
      '③ 养一盆好活的绿植，绿萝或龟背竹都行，一周浇一次就活\n\n' +
      '空间不用大，有一个角落完全属于自己就够了。',
    tags: ['家居', '出租屋改造', '收纳'],
  },
  {
    keywords: ['摄影', '拍照', '出片', '手机', '调色'],
    title: '手机也能拍出高级感的三个小技巧',
    caption:
      '光线比设备重要得多，掌握这几点，随手拍也会被追着问参数。\n\n' +
      '① 尽量用侧光或窗边自然光，避开正午顶光和直射闪光\n\n' +
      '② 打开九宫格辅助线，主体放在交叉点上，画面立刻稳了\n\n' +
      '③ 后期只统一一件事：把色温和高光调一致，整套图就有质感\n\n' +
      '拍之前先擦一下镜头，这步最容易被忽略，但效果最直接。',
    tags: ['摄影', '手机摄影', '拍照技巧'],
  },
  {
    keywords: ['职场', '副业', '效率', '存钱', '成长'],
    title: '上班族稳妥开启副业的几点建议',
    caption:
      '副业不是 all in，而是用可控的时间试错，让主业副业互不拖累。\n\n' +
      '① 从你已有的技能出发，写作、设计、咨询都行，别从零学新东西\n\n' +
      '② 先小成本跑通一次完整流程，收到第一笔钱再谈放大\n\n' +
      '③ 固定投入时间，比如每周三小时，细水长流比突击靠谱得多\n\n' +
      '能持续半年以上的副业，才值得继续加码。',
    tags: ['职场', '副业', '自我提升'],
  },
  {
    keywords: ['咖啡', '探店', '日常', '独处', '放松'],
    title: '一个人的咖啡馆放空指南',
    caption:
      '偶尔从人群里抽离出来，点一杯手冲，看窗外发会儿呆，是很必要的充电。\n\n' +
      '① 选靠窗但不暴晒的位置，光线柔和，也不容易被打扰\n\n' +
      '② 浅烘豆子偏果酸适合下午，深烘更稳适合想安静的时候\n\n' +
      '③ 不带电脑，只带本书，或者什么都不带，就坐着\n\n' +
      '慢下来，才知道自己真正想要什么。',
    tags: ['咖啡', '独处', '生活方式'],
  },
];
