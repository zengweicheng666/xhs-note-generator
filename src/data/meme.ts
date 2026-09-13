// EXPORTS: IMemeRecord, MOOD_KEYWORDS

export interface IMemeRecord {
  id: string;
  keyword: string;
  imageUrl: string;
  title: string;
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
