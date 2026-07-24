import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

// Memoiza a execução em voo — `PlayerApp` chama `iniciarAuthMultiplayer()` de mais de um
// efeito (`useMinhaFicha` + sync de tokens do mapa), ambos disparando no mount. Sem isso,
// dois `signInAnonymously()` concorrentes podem criar DUAS identidades anônimas diferentes
// na mesma aba — o `vincular-jogador` de uma chamada pode acabar vinculando a ficha ao
// auth_uid "errado" (o que perde a corrida), enquanto a sessão que persiste no fim é a
// outra: o jogador liga, mas a leitura seguinte de `characters_privado` (filtrada por
// `auth.uid()`) não bate com nada — "link inválido ou ficha ainda não vinculada", mesmo com
// o link certo. Um único `Promise` em voo garante que todo mundo espera a MESMA execução.
let promessaEmVoo: Promise<void> | null = null;

/**
 * Garante uma sessão anônima (Supabase Auth) e, se a URL trouxer `?t=` (owner_token
 * de jogador) ou `?gm=` (token de mestre), vincula via Edge Function
 * (mesa-estatica-multiplayer-completo.md §6, §V.2). Idempotente — seguro chamar de
 * novo a cada boot, e seguro chamar em paralelo dentro do mesmo boot (ver `promessaEmVoo`
 * acima); sem env vars do Supabase, vira no-op (app roda 100% local).
 */
export function iniciarAuthMultiplayer(): Promise<void> {
  if (!promessaEmVoo) promessaEmVoo = executar();
  return promessaEmVoo;
}

async function executar(): Promise<void> {
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

async function extrairErroFuncao(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const corpo = await error.context.json();
      if (typeof corpo?.erro === 'string') return corpo.erro;
    } catch {
      // corpo não era JSON — cai no fallback abaixo
    }
  }
  return 'falha de rede — confira a conexão';
}

export type ResultadoVinculo = { ok: true } | { ok: false; erro: string };

/**
 * Vínculo de mestre disparado pela UI (`VinculoMestre.tsx`), não pela URL — mesma Edge
 * Function que `?gm=` já usa dentro de `executar()` acima, sem duplicar o bootstrap de
 * sessão anônima (reusa `iniciarAuthMultiplayer()`, já memoizado).
 */
export async function vincularComoMestre(gmToken: string): Promise<ResultadoVinculo> {
  const cliente = supabase;
  if (!cliente) return { ok: false, erro: 'multiplayer não configurado nesta máquina' };
  await iniciarAuthMultiplayer();
  const { error } = await cliente.functions.invoke('vincular-mestre', { body: { gm_token: gmToken } });
  if (!error) return { ok: true };
  return { ok: false, erro: await extrairErroFuncao(error) };
}

/** Consulta a função SQL `is_gm()` (migração 0002) via RPC — um boolean literal, sem os
 *  falsos positivos/negativos de tentar inferir o vínculo lendo uma tabela GM-only (uma
 *  linha vazia por RLS e uma tabela genuinamente vazia parecem a mesma coisa). */
export async function consultarIsGm(): Promise<boolean> {
  const cliente = supabase;
  if (!cliente) return false;
  const { data, error } = await cliente.rpc('is_gm');
  return !error && data === true;
}
