import type { TokenMapa } from '../state/types';
import { supabase } from '../lib/supabaseClient';
import { assinarStatusCanal, desconectarCanal } from '../lib/statusMesa';
import { useStore } from '../state/store';
import { criarDebouncePorChave } from './debounce';
import { executarComRetentativa, resolverPendencia, retomarPendenciasPersistidas } from './filaPendencias';
import { eraRemocaoExplicita } from './remocaoExplicita';
import { computarDiffTokens } from './tokensDiff';

const PREFIXO_DELETE = 'delete:';

/** Dado uma chave pendente (id de token, ou `delete:${id}`) e o estado ATUAL da store, decide
 *  o que reenviar — função pura, testável sem mock de Supabase (mesmo padrão de `paraLinha`).
 *  `null` = nada a fazer (o token não existe mais localmente e não era uma pendência de
 *  delete — caso raro, mas não deve ficar reenviando pra sempre). */
export function resolverReplayToken(chave: string, tokens: TokenMapa[]): TokenMapa | 'apagar' | null {
  if (chave.startsWith(PREFIXO_DELETE)) return 'apagar';
  return tokens.find((t) => t.id === chave) ?? null;
}

/** Mais curto que o de fichas/npcs (`ATRASO_PUSH_MS` em `fichasSync.ts`) — posição de token
 *  no mapa quer parecer "ao vivo" pros outros participantes; ainda assim, junta a rajada de
 *  `pointermove` de um arrasto (dezenas por segundo) numa escrita só, em vez de uma por
 *  evento — era a causa do lag ao arrastar token (visto ao vivo em 24/07). */
const ATRASO_PUSH_MS = 150;

interface LinhaTokenSupabase {
  id: string;
  participante_id: string;
  tipo: 'pc' | 'npc';
  x: number;
  y: number;
}

const paraLinha = (t: TokenMapa): LinhaTokenSupabase => ({
  id: t.id,
  participante_id: t.participanteId,
  tipo: t.tipo,
  x: t.x,
  y: t.y,
});

const paraToken = (r: LinhaTokenSupabase): TokenMapa => ({
  id: r.id,
  participanteId: r.participante_id,
  tipo: r.tipo,
  x: r.x,
  y: r.y,
});

/** Tokens sendo arrastados localmente agora (MapaTab.tsx/MapaJogadorView.tsx marcam no
 *  pointerdown, desmarcam no pointerup) — o handler de Realtime abaixo pula update remoto
 *  pra esses ids. Sem isso, o eco da própria escrita (sempre ≥150ms atrás, por causa do
 *  debounce de `agendarUpsert`) chega no meio de um arrasto rápido e sobrescreve a posição
 *  local mais recente com uma mais antiga — visível como o token "caindo atrás" do cursor
 *  por um instante, até o próximo pointermove corrigir. */
const tokensEmArrasto = new Set<string>();
export function marcarTokenEmArrasto(id: string): void {
  tokensEmArrasto.add(id);
}
export function desmarcarTokenEmArrasto(id: string): void {
  tokensEmArrasto.delete(id);
}

/**
 * Fase A (mesa-estatica-multiplayer-completo.md §11): sincroniza só a posição/existência
 * dos tokens via Supabase Realtime. Zustand continua a fonte local/otimista; o Supabase
 * é a fonte compartilhada por cima (mesmo princípio da sessão pública/privada).
 *
 * Sem Anonymous Auth/RLS por dono ainda (isso é Fase B/F) — a policy da tabela `tokens`
 * nesta fase é aberta pra leitura/escrita com a chave anon. Aceitável só porque o link
 * do projeto não é público (grupo fechado no Discord).
 */
export function iniciarSyncTokens(): () => void {
  const cliente = supabase;
  if (!cliente) return () => {};

  let aplicandoRemoto = false;
  let tokensAnteriores = useStore.getState().mapa.tokens;

  // busca inicial — sem isso, uma sessão sem localStorage (bundle do jogador; ou o GM numa
  // máquina limpa, ver CLAUDE.md "portabilidade") só veria tokens a partir da próxima
  // mudança, nunca os que já existiam. `aplicandoRemoto` evita ecoar de volta pro servidor.
  cliente
    .from('tokens')
    .select('*')
    .then(({ data, error }) => {
      if (error || !data) return;
      aplicandoRemoto = true;
      try {
        useStore.setState((s) => ({ mapa: { ...s.mapa, tokens: (data as LinhaTokenSupabase[]).map(paraToken) } }));
      } finally {
        tokensAnteriores = useStore.getState().mapa.tokens;
        aplicandoRemoto = false;
      }
    });

  const agendarUpsert = criarDebouncePorChave<TokenMapa>(ATRASO_PUSH_MS, (_id, token) => {
    executarComRetentativa('tokens-sync', token.id, () =>
      cliente.from('tokens').upsert(paraLinha(useStore.getState().mapa.tokens.find((t) => t.id === token.id) ?? token)),
    );
  });

  const unsubscribeLocal = useStore.subscribe((state, prevState) => {
    if (aplicandoRemoto || state.mapa.tokens === prevState.mapa.tokens) return;

    const { upserts, removidos } = computarDiffTokens(tokensAnteriores, state.mapa.tokens);
    tokensAnteriores = state.mapa.tokens;

    for (const token of upserts) agendarUpsert(token.id, token);
    // só apaga no servidor se o botão "remover" marcou o id de propósito — ver
    // remocaoExplicita.ts.
    for (const id of removidos) {
      if (!eraRemocaoExplicita(id)) continue;
      executarComRetentativa('tokens-sync', `${PREFIXO_DELETE}${id}`, () => cliente.from('tokens').delete().eq('id', id));
    }
  });

  // reenvia o que ficou pendente de uma sessão anterior (offline no meio de uma edição, ou
  // aba fechada antes de reconectar) — relê a store ATUAL, nunca um payload congelado.
  for (const chave of retomarPendenciasPersistidas('tokens-sync')) {
    const replay = resolverReplayToken(chave, useStore.getState().mapa.tokens);
    if (replay === 'apagar') {
      const id = chave.slice(PREFIXO_DELETE.length);
      executarComRetentativa('tokens-sync', chave, () => cliente.from('tokens').delete().eq('id', id));
    } else if (replay) {
      executarComRetentativa('tokens-sync', chave, () => cliente.from('tokens').upsert(paraLinha(replay)));
    } else {
      resolverPendencia('tokens-sync', chave);
    }
  }

  const canal = cliente
    .channel('tokens-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tokens' }, (payload) => {
      aplicandoRemoto = true;
      try {
        const s = useStore.getState();
        if (payload.eventType === 'DELETE') {
          const idRemovido = (payload.old as { id: string }).id;
          if (tokensEmArrasto.has(idRemovido)) return;
          useStore.setState({ mapa: { ...s.mapa, tokens: s.mapa.tokens.filter((t) => t.id !== idRemovido) } });
        } else {
          const token = paraToken(payload.new as LinhaTokenSupabase);
          if (tokensEmArrasto.has(token.id)) return;
          const existe = s.mapa.tokens.some((t) => t.id === token.id);
          const tokens = existe
            ? s.mapa.tokens.map((t) => (t.id === token.id ? token : t))
            : [...s.mapa.tokens, token];
          useStore.setState({ mapa: { ...s.mapa, tokens } });
        }
      } finally {
        tokensAnteriores = useStore.getState().mapa.tokens;
        aplicandoRemoto = false;
      }
    })
    .subscribe(assinarStatusCanal('tokens-sync'));

  return () => {
    unsubscribeLocal();
    desconectarCanal('tokens-sync');
    cliente.removeChannel(canal);
  };
}
