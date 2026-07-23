import { supabase } from '../lib/supabaseClient';

/**
 * Garante uma sessão anônima (Supabase Auth) e, se a URL trouxer `?t=` (owner_token
 * de jogador) ou `?gm=` (token de mestre), vincula via Edge Function
 * (mesa-estatica-multiplayer-completo.md §6, §V.2). Idempotente — seguro chamar de
 * novo a cada boot; sem env vars do Supabase, vira no-op (app roda 100% local).
 */
export async function iniciarAuthMultiplayer(): Promise<void> {
  const cliente = supabase;
  if (!cliente) return;

  const { data: sessaoAtual } = await cliente.auth.getSession();
  if (!sessaoAtual.session) {
    const { error } = await cliente.auth.signInAnonymously();
    if (error) {
      console.error('[multiplayer] sign-in anônimo falhou', error);
      return;
    }
  }

  const params = new URLSearchParams(window.location.search);
  const ownerToken = params.get('t');
  const gmToken = params.get('gm');

  if (ownerToken) {
    const { error } = await cliente.functions.invoke('vincular-jogador', { body: { owner_token: ownerToken } });
    if (error) console.error('[multiplayer] vincular-jogador falhou', error);
  }
  if (gmToken) {
    const { error } = await cliente.functions.invoke('vincular-mestre', { body: { gm_token: gmToken } });
    if (error) console.error('[multiplayer] vincular-mestre falhou', error);
  }
}
