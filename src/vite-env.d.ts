/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ARK_API_KEY?: string
  readonly VITE_ARK_IMAGE_MODEL?: string
  readonly VITE_ARK_TEXT_MODEL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
