// ---- plugin:jokebear_image_generator_1 ----
// ============================================================
// 插件 jokebear_image_generator_1 (自嘲熊配图生成) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface JokebearImageGeneratorOneInput {
  /** 生成表情包的情绪关键词，如开心、生气、委屈、躺平等 */
  emotion_keyword: string;
  /** 图片比例，支持的值：1:1、3:4 */
  image_ratio?: string;
}

/**
 * capabilityClient.load('jokebear_image_generator_1').call<JokebearImageGeneratorOneOutput>('textToImage', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { images } = result;
 * 返回值形如：
 *   {"images":["示例文本"]}
 */
export interface JokebearImageGeneratorOneOutput {
  /** [object Object] */
  images: string[];
}
// ---- end:jokebear_image_generator_1 ----

// ---- plugin:self_deprecating_bear_note_generator_1 ----
// ============================================================
// 插件 self_deprecating_bear_note_generator_1 (自嘲熊笔记文案生成) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface SelfDeprecatingBearNoteGeneratorOneInput {
  /** 用户输入的情绪关键词，如：上班、摸鱼、加班、周五、周一、开会、下班、加薪、内卷等 */
  emotion_keyword: string;
}

/**
 * capabilityClient.load('self_deprecating_bear_note_generator_1').call<SelfDeprecatingBearNoteGeneratorOneOutput>('textToJson', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { title, content, tags } = result;
 * 返回值形如：
 *   {"title":"示例文本","content":"示例文本","tags":[]}
 */
export interface SelfDeprecatingBearNoteGeneratorOneOutput {
  /** 小红书笔记标题，15-25字，包含1-2个相关emoji，要有悬念或共鸣感，符合自嘲风格 */
  title: string;
  /** 笔记正文内容，200-300字，分3-5个短段落，适当使用emoji，口语化表达，丧中带治愈，有共鸣点 */
  content: string;
  /** 小红书标签数组，5-8个标签，包含自嘲熊、打工人相关标签和内容相关关键词，items schema: {tag: string(标签内容)} */
  tags: unknown[];
}
// ---- end:self_deprecating_bear_note_generator_1 ----