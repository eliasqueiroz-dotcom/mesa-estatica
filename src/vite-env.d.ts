/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Fase D (mesa-estatica-multiplayer-completo.md §11) — desligado por padrão; liga o
   *  caminho remoto (resolver-rolagem/gerenciar-fila-forcada) no lugar do local/BroadcastChannel. */
  readonly VITE_FASE_D_ROLAGEM_REMOTA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
