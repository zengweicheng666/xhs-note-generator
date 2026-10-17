// ---- plugin:generic_image_generator_1 ----
// ============================================================
// 插件 generic_image_generator_1 (通用配图生成) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface GenericImageGeneratorOneInput {
  /** 生成配图的主题关键词，如：穿搭、美食、旅行、护肤、健身等 */
  topic_keyword: string;
  /** 图片比例，支持的值：1:1、3:4 */
  image_ratio?: string;
}

/**
 * capabilityClient.load('generic_image_generator_1').call<GenericImageGeneratorOneOutput>('textToImage', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { images } = result;
 * 返回值形如：
 *   {"images":["示例文本"]}
 */
export interface GenericImageGeneratorOneOutput {
  /** [object Object] */
  images: string[];
}
// ---- end:generic_image_generator_1 ----

// ---- plugin:generic_note_generator_1 ----
// ============================================================
// 插件 generic_note_generator_1 (通用笔记文案生成) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface GenericNoteGeneratorOneInput {
  /** 用户输入的主题关键词，如：穿搭、美食、旅行、护肤、健身、读书等 */
  topic_keyword: string;
}

/**
 * capabilityClient.load('generic_note_generator_1').call<GenericNoteGeneratorOneOutput>('textToJson', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { title, content, tags } = result;
 * 返回值形如：
 *   {"title":"示例文本","content":"示例文本","tags":[]}
 */
export interface GenericNoteGeneratorOneOutput {
  /** 小红书笔记标题，15-25字，包含1-2个相关emoji，要有悬念或共鸣感 */
  title: string;
  /** 笔记正文内容，200-300字，分3-5个短段落，适当使用emoji，口语化表达，有干货和共鸣点 */
  content: string;
  /** 小红书标签数组，5-8个标签，包含主题相关关键词和热门话题，items schema: {tag: string(标签内容)} */
  tags: unknown[];
}
// ---- end:generic_note_generator_1 ----
