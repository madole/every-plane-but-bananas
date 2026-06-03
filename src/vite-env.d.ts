/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CESIUM_ION_TOKEN: string
  readonly VITE_DEBUG_LOGGING?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
