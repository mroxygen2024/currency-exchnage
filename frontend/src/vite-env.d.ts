/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_API_TIMEOUT?: string;
  readonly VITE_VALIDATE_API_RESPONSES?: string;
  readonly VITE_LOG_API_VALIDATION_ERRORS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}