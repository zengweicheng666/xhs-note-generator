// EXPORTS: IMemeRecord, MOOD_KEYWORDS

export interface IMemeRecord {
  id: string;
  keyword: string;
  imageUrl: string;
  title: string;
  titles?: string[];
  caption: string;
  tags: string[];
  createdAt: number;
}

export const MOOD_KEYWORDS = [
  '加班',
  '周一',
  '周末结束',
  '穷',
  '躺平',
  '摸鱼',
  'emo',
  '年底',
  '养生',
  '社恐',
  '上班',
  '下班',
  '开会',
  '内卷',
  '摆烂',
  '早起',
  '吃土',
  '打工',
  '没睡好',
  '不想动',
];

// 本地离线预设：当平台 AI 插件不可用时（如纯本地 dev 环境），按关键词匹配返回预生成图文
export interface ILocalPreset {
  keywords: string[];
  image: string;
  title: string;
  caption: string;
  tags: string[];
}

export const LOCAL_PRESETS: ILocalPreset[] = [
  {
    keywords: ['加班', '上班', '摸鱼', '无所事事', '精疲力尽', '开会', '打工', '内卷', '不想动'],
    image: '/bears/bear1_exhausted.png',
    title: '我是怎么做到无所事事，又精疲力尽的',
    caption: '班加了，事没做完，人先废了。坐在工位上，灵魂已经下班八小时。',
    tags: ['打工人', '表情包', '摸鱼'],
  },
  {
    keywords: ['穷', '吃土', '年底', '没钱', '善待'],
    image: '/bears/bear2_broke.png',
    title: '今年总算穷到头了，2026求善待',
    caption: '钱包比脸还干净，兜里的硬币都在替我哭。再不下班，我就要开始搜自己值多少钱了。',
    tags: ['穷', '年底', '求善待'],
  },
  {
    keywords: ['周一', '早起', '没睡好', '起床', '闹钟'],
    image: '/bears/bear3_monday.png',
    title: '周一早上的我，和被子锁死了',
    caption: '闹钟响第三遍了，我和被窝签了终身合同，谁也别想撕毁。',
    tags: ['周一不想上班', '起床气'],
  },
  {
    keywords: ['周末', '周末结束', '躺平', '放假', '休息'],
    image: '/bears/bear4_weekend.png',
    title: '周末就是用来浪费的',
    caption: '啤酒、薯片、遥控器，三件套齐活。今天的KPI是：一根手指都不动。',
    tags: ['周末躺平', '摆烂'],
  },
  {
    keywords: ['养生', '保温杯', '枸杞', '健康'],
    image: '/bears/bear5_health.png',
    title: '熊也开始养生了',
    caption: '保温杯里泡枸杞，熬最野的夜，补最虚的身。主打一个边造边救。',
    tags: ['养生', '保温杯'],
  },
  {
    keywords: ['摆烂', 'emo', '社恐', '无所谓', '关我啥事'],
    image: '/bears/bear6_whatever.png',
    title: '别人的钱财乃我的身外之物',
    caption: '关我啥事，我先瘫会儿。你们卷，你们赢，我负责活着。',
    tags: ['meme', '摆烂', '无所谓'],
  },
  {
    keywords: ['神灯', '许愿', '愿望', '阿拉丁'],
    image: '/bears/bear7_lamp.png',
    title: '熊捡到了阿拉丁神灯',
    caption: '灯神说可以满足我三个愿望。我说：再要三个神灯。',
    tags: ['神灯', '许愿', '段子'],
  },
  {
    keywords: ['跨年', '过年', '烟花', '新年'],
    image: '/bears/bear8_fireworks.png',
    title: '我一个键盘乱敲直接跨年',
    caption: '烟花在天上炸，我在床上躺，但我也是过年了。祝大家新的一年，穷但快乐。',
    tags: ['跨年', '新年快乐'],
  },
  {
    keywords: ['草莓', '莓事', '莓事的'],
    image: '/bears/bear9_strawberry.png',
    title: '莓事的莓事的，熊总会实现草莓自由的',
    caption: '今天也是想吃草莓到流泪的一天。等我有钱了，草莓按吨买。',
    tags: ['草莓自由', '莓事的'],
  },
  {
    keywords: ['熬夜', '作息', '晚睡', '失眠', '凌晨'],
    image: '/bears/bear10_latenight.png',
    title: '作息是乱乱的，熊笨笨的意志是淡淡的',
    caption: '凌晨三点的我，比白天的我精神多了。身体睡了，手机还在加班。',
    tags: ['熬夜', '作息混乱'],
  },
];
