interface ImportMetaEnv {
  readonly VITE_DEBUG_AI?: string;
  readonly VITE_START_THEATER?: string;
  readonly [key: string]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
