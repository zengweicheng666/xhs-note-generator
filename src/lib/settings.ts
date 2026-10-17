// API 设置：保存在浏览器 localStorage，界面上可随时修改

export interface IArkSettings {
  apiKey: string
  imageModel: string
  textModel: string
}

const STORAGE_KEY = 'note_ark_settings_v1'

const ENV_IMAGE_MODEL =
  (import.meta.env.VITE_ARK_IMAGE_MODEL as string) || 'doubao-seedream-5-0-260128'
const ENV_TEXT_MODEL =
  (import.meta.env.VITE_ARK_TEXT_MODEL as string) || 'doubao-seed-2-0-mini-260428'

export const DEFAULT_SETTINGS: IArkSettings = {
  apiKey: '',
  imageModel: ENV_IMAGE_MODEL,
  textModel: ENV_TEXT_MODEL,
}

export function getSettings(): IArkSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw)
    return {
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      imageModel: parsed.imageModel || ENV_IMAGE_MODEL,
      textModel: parsed.textModel || ENV_TEXT_MODEL,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(s: IArkSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

// 是否已配置可用 key（界面设置优先，回退 .env.local）
export function hasApiKey(): boolean {
  return !!getSettings().apiKey || !!import.meta.env.VITE_ARK_API_KEY
}
