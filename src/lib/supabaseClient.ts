import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * `null` quando as env vars não estão presentes — clone limpo sem `.env` continua
 * rodando 100% local (CLAUDE.md: portabilidade), só sem sincronização multiplayer.
 */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;

if (!supabase && import.meta.env.DEV) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY ausentes — multiplayer desligado, app roda 100% local.',
  );
}
