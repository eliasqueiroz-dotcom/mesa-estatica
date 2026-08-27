import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

// Chave de localStorage do token de mestre — compartilhada por `VinculoMestre.tsx` (vínculo
// RLS) e `GateOverlay.tsx` (barreira visual da tela do mestre), que reaproveita o mesmo token.
export const CHAVE_TOKEN_MESTRE = 'estatica-gm-token';

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

export type ResultadoVinculo = { ok: true } | { ok: false; erro: string; tokenInvalido?: boolean };

/**
 * Vínculo de mestre disparado pela UI (`VinculoMestre.tsx`), não pela URL — mesma Edge
 * Function que `?gm=` já usa dentro de `executar()` acima, sem duplicar o bootstrap de
 * sessão anônima (reusa `iniciarAuthMultiplayer()`, já memoizado).
 *
 * `tokenInvalido` distingue o único "não" definitivo do servidor (403 — hash não bate,
 * ver `vincular-mestre/index.ts`) de falha ambígua (rede, 429 de rate limit, sessão) —
 * `GateOverlay.tsx` só tranca de novo um token já salvo nesse caso, nunca por um erro
 * transitório que derrubaria quem já estava jogando.
 */
export async function vincularComoMestre(gmToken: string): Promise<ResultadoVinculo> {
  const cliente = supabase;
  if (!cliente) return { ok: false, erro: 'multiplayer não configurado nesta máquina' };
  await iniciarAuthMultiplayer();
  const { error } = await cliente.functions.invoke('vincular-mestre', { body: { gm_token: gmToken } });
  if (!error) return { ok: true };
  return {
    ok: false,
    erro: await extrairErroFuncao(error),
    tokenInvalido: error instanceof FunctionsHttpError && error.context.status === 403,
  };
}

/**
 * Troca o GM_TOKEN vigente (ROADMAP.md item 2, Parte B) — a Edge Function `trocar-token-mestre`
 * não checa is_gm(), só exige o token atual válido, então isso funciona mesmo se esta sessão
 * nunca tiver se vinculado como mestre.
 */
export async function trocarTokenMestre(tokenAtual: string, tokenNovo: string): Promise<ResultadoVinculo> {
  const cliente = supabase;
  if (!cliente) return { ok: false, erro: 'multiplayer não configurado nesta máquina' };
  await iniciarAuthMultiplayer();
  const { error } = await cliente.functions.invoke('trocar-token-mestre', {
    body: { token_atual: tokenAtual, token_novo: tokenNovo },
  });
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

// Memoiza por boot (mesmo padrão de `promessaEmVoo` acima) — `GateOverlay.tsx` e
// `VinculoMestre.tsx` fazem essa MESMA pergunta ("esta sessão está vinculada como mestre?")
// no mount, em paralelo. Sem compartilhar a promise, os dois disparavam a sequência
// consultarIsGm→autocura (que pode incluir uma chamada a `vincular-mestre`) por conta
// própria — duas tentativas gastas contra o rate limit da function pra confirmar o mesmo
// fato uma vez só. Com isso, o segundo chamador só espera o resultado do primeiro.
let promessaVinculoMestre: Promise<boolean> | null = null;

/**
 * Confirma se esta sessão já está vinculada como mestre — com autocura se `is_gm()` disser
 * "não" mas houver um token salvo neste navegador (sessão anônima nova, ex.: troca de origem,
 * ou storage limpo à parte — mesmo cenário de 24/07 que motivou o pill de `VinculoMestre.tsx`).
 * Se a autocura falhar com um 403 definitivo (token realmente rotacionado/inválido, não erro
 * de rede/rate-limit), o token salvo é descartado — sem isso, quem ficou com um token antigo
 * continuaria "vinculado" localmente pra sempre, mesmo depois de revogado de propósito.
 */
export function verificarVinculoMestre(): Promise<boolean> {
  if (!promessaVinculoMestre) promessaVinculoMestre = executarVerificacaoVinculo();
  return promessaVinculoMestre;
}

async function executarVerificacaoVinculo(): Promise<boolean> {
  await iniciarAuthMultiplayer();
  if (await consultarIsGm()) return true;

  let tokenSalvo: string | null;
  try {
    tokenSalvo = localStorage.getItem(CHAVE_TOKEN_MESTRE);
  } catch {
    return false; // sem acesso a storage — não dá pra confirmar nada
  }
  if (!tokenSalvo) return false;

  const resultado = await vincularComoMestre(tokenSalvo);
  if (resultado.ok) return true;

  if (resultado.tokenInvalido) {
    try {
      localStorage.removeItem(CHAVE_TOKEN_MESTRE);
    } catch {
      // sem acesso a storage — nada a limpar
    }
  }
  return false;
}
