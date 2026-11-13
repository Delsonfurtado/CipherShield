/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_INACTIVITY_TIMEOUT_MINUTES: string;
  readonly VITE_CLIPBOARD_CLEAR_SECONDS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
