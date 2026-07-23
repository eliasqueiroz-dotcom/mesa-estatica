import { supabase } from '../lib/supabaseClient';

/**
 * Link do jogador (mesa-estatica-multiplayer-completo.md Parte V §4): o `owner_token`
 * (UUID gerado em `fichasSync.ts` na criação da ficha) resolve pra 1 ficha via a Edge
 * Function `vincular-jogador` (Fase B) já ligada no boot (`auth.ts`).
 */
export function montarLinkJogador(ownerToken: string): string {
  const base = `${location.origin}${import.meta.env.BASE_URL}`;
  return `${base}jogador.html?t=${ownerToken}`;
}

/**
 * Busca o `owner_token` de uma ficha em `characters_privado` (RLS: só GM lê de qualquer
 * ficha). `null` se o multiplayer não estiver configurado nesta máquina ou a ficha ainda
 * não tiver sido sincronizada pro Supabase (`fichasSync.ts` roda em background no boot).
 */
export async function buscarOwnerToken(fichaId: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('characters_privado').select('owner_token').eq('id', fichaId).maybeSingle();
  if (error || !data) return null;
  return data.owner_token as string;
}

/**
 * Regenera o `owner_token` (UUID novo) — mitigação de link vazado (§13): invalida o link
 * antigo sem afetar as demais fichas. Quem já vinculou o dispositivo (`auth_uid` gravado
 * por `vincular-jogador`) continua com acesso; só um link novo (ainda não usado) fica
 * inválido.
 */
export async function regenerarOwnerToken(fichaId: string): Promise<string | null> {
  if (!supabase) return null;
  const novoToken = crypto.randomUUID();
  const { error } = await supabase.from('characters_privado').update({ owner_token: novoToken }).eq('id', fichaId);
  if (error) return null;
  return novoToken;
}
