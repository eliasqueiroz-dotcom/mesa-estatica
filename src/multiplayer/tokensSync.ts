import type { TokenMapa } from '../state/types';
import { supabase } from '../lib/supabaseClient';
import { useStore } from '../state/store';
import { computarDiffTokens } from './tokensDiff';

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

  const unsubscribeLocal = useStore.subscribe((state, prevState) => {
    if (aplicandoRemoto || state.mapa.tokens === prevState.mapa.tokens) return;

    const { upserts, removidos } = computarDiffTokens(tokensAnteriores, state.mapa.tokens);
    tokensAnteriores = state.mapa.tokens;

    if (upserts.length > 0) {
      cliente
        .from('tokens')
        .upsert(upserts.map(paraLinha))
        .then(({ error }) => {
          if (error) console.error('[tokensSync] upsert falhou', error);
        });
    }
    for (const id of removidos) {
      cliente
        .from('tokens')
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.error('[tokensSync] delete falhou', error);
        });
    }
  });

  const canal = cliente
    .channel('tokens-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tokens' }, (payload) => {
      aplicandoRemoto = true;
      try {
        const s = useStore.getState();
        if (payload.eventType === 'DELETE') {
          const idRemovido = (payload.old as { id: string }).id;
          useStore.setState({ mapa: { ...s.mapa, tokens: s.mapa.tokens.filter((t) => t.id !== idRemovido) } });
        } else {
          const token = paraToken(payload.new as LinhaTokenSupabase);
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
    .subscribe();

  return () => {
    unsubscribeLocal();
    cliente.removeChannel(canal);
  };
}
