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
    caption: '不追爆款，只追适合自己。三件基础单品叠穿，高级感和舒适度都拿捏住了，日常也能体面出门。',
    tags: ['穿搭', '通勤OOTD', '基础款'],
  },
  {
    keywords: ['美食', '探店', '做饭', '食谱', '下午茶'],
    title: '在家也能复刻的治愈系早餐',
    caption: '十分钟搞定颜值与味道并存的早午餐，少油少糖但满足感拉满。好好吃饭，是低成本的自愈方式。',
    tags: ['美食', '居家食谱', '早餐'],
  },
  {
    keywords: ['旅行', '出游', '攻略', '周末', 'citywalk'],
    title: '不用请假的小众城市漫步路线',
    caption: '避开人从众，把周末过成微度假。一条路线、三家小店、五张出片机位，收藏起来周末就出发。',
    tags: ['旅行', 'Citywalk', '周末去哪'],
  },
  {
    keywords: ['护肤', '化妆', '好物', '平价', '敏感肌'],
    title: '敏感肌亲测好用的极简护肤思路',
    caption: '少即是多。把护肤步骤砍到三件，皮肤反而稳了。不盲目跟风，适合自己才是真的好用。',
    tags: ['护肤', '敏感肌', '极简护肤'],
  },
  {
    keywords: ['健身', '减脂', '运动', '瑜伽', '自律'],
    title: '新手也能坚持的居家运动计划',
    caption: '不办卡也能动起来。每天二十分钟，跟练零基础友好，坚持一个月身体会给你正向反馈。',
    tags: ['健身', '居家运动', '自律'],
  },
  {
    keywords: ['读书', '书单', '成长', '自我提升'],
    title: '今年让我反复回味的几本书',
    caption: '读书是成本最低的见世面。挑三本不同领域的书交叉着读，认知的边界会悄悄被打开。',
    tags: ['读书', '书单分享', '自我提升'],
  },
  {
    keywords: ['家居', '租房', '收纳', '布置', '好物'],
    title: '小出租屋也能拥有的治愈角落',
    caption: '不砸墙不翻修，用灯光、绿植和一块地毯，把出租屋变成下班想回的地方。',
    tags: ['家居', '出租屋改造', '收纳'],
  },
  {
    keywords: ['摄影', '拍照', '出片', '手机', '调色'],
    title: '手机也能拍出高级感的三个小技巧',
    caption: '光线比设备重要。掌握构图、留白和统一色调，随手拍也能发朋友圈被追着问参数。',
    tags: ['摄影', '手机摄影', '拍照技巧'],
  },
  {
    keywords: ['职场', '副业', '效率', '存钱', '成长'],
    title: '上班族稳妥开启副业的几点建议',
    caption: '副业不是all in，而是用空闲时间试错。先小成本跑通再放大，主业副业才能互不拖累。',
    tags: ['职场', '副业', '自我提升'],
  },
  {
    keywords: ['咖啡', '探店', '日常', '独处', '放松'],
    title: '一个人的咖啡馆放空指南',
    caption: '偶尔从人群里抽离出来，点一杯手冲，看窗外发会儿呆。慢下来，才知道自己想要什么。',
    tags: ['咖啡', '独处', '生活方式'],
  },
];
