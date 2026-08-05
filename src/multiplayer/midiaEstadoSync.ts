import { supabase } from '../lib/supabaseClient';
import { assinarStatusCanal, desconectarCanal } from '../lib/statusMesa';
import { useStore } from '../state/store';
import type { EstadoMidia, ModoLoopMidia } from '../state/types';
import { criarDebouncePorChave } from './debounce';

type Cliente = NonNullable<typeof supabase>;

const ID_MIDIA = 'midia';

/** Mesmo valor de `tokensSync.ts` — junta o burst de arrastar a barra de seek numa escrita
 *  só; em cliques discretos (play/pause/próxima/loop) não faz diferença perceptível. */
const ATRASO_PUSH_MS = 150;

export interface Linha {
  id: string;
  faixa_atual_id: string | null;
  tocando: boolean;
  posicao_segundos: number;
  modo_loop: ModoLoopMidia;
  atualizado_em: string;
  volume: number;
}

export type PatchEstadoMidia = Pick<EstadoMidia, 'faixaAtualId' | 'tocando' | 'posicaoSegundos' | 'modoLoop' | 'atualizadoEm' | 'volume'>;

export const paraLinha = (m: PatchEstadoMidia): Omit<Linha, 'id'> => ({
  faixa_atual_id: m.faixaAtualId,
  tocando: m.tocando,
  posicao_segundos: m.posicaoSegundos,
  modo_loop: m.modoLoop,
  atualizado_em: m.atualizadoEm,
  volume: m.volume,
});

export const paraEstadoMidia = (r: Linha): PatchEstadoMidia => ({
  faixaAtualId: r.faixa_atual_id,
  tocando: r.tocando,
  posicaoSegundos: r.posicao_segundos,
  modoLoop: r.modo_loop,
  atualizadoEm: r.atualizado_em,
  volume: r.volume,
});

let aplicandoRemotoContagem = 0;

/** `MidiaPlayerGM.tsx` usa isso pra decidir: uma mudança em `s.midia` veio de uma ação
 *  local (resincroniza o `<audio>` na hora, sem limiar de desvio) ou de um eco remoto
 *  (aplica `precisaResincronizar` antes de re-sincronizar, ver `posicaoMidia.ts`). */
export function estaAplicandoRemotoMidia(): boolean {
  return aplicandoRemotoContagem > 0;
}

/**
 * Sincroniza o estado de playback do jukebox (`midia_estado`, linha singleton) — mesmo
 * padrão de `mapaPublicoSync.ts`, com debounce no push (arrastar a barra de seek é rajada
 * de eventos, igual arrastar um token no mapa).
 */
export function iniciarSyncMidiaEstado(): () => void {
  const cliente = supabase;
  if (!cliente) return () => {};

  const agendarPush = criarDebouncePorChave<PatchEstadoMidia>(ATRASO_PUSH_MS, (_chave, midia) => {
    cliente
      .from('midia_estado')
      .upsert({ id: ID_MIDIA, ...paraLinha(midia) })
      .then(({ error }) => {
        if (error) console.error('[midiaEstadoSync] push falhou', error);
      });
  });

  const unsubscribeLocal = useStore.subscribe((state, prevState) => {
    if (aplicandoRemotoContagem > 0) return;
    const { faixaAtualId, tocando, posicaoSegundos, modoLoop, atualizadoEm, volume } = state.midia;
    const anterior = prevState.midia;
    if (
      faixaAtualId === anterior.faixaAtualId &&
      tocando === anterior.tocando &&
      posicaoSegundos === anterior.posicaoSegundos &&
      modoLoop === anterior.modoLoop &&
      volume === anterior.volume
    ) {
      return;
    }
    agendarPush(ID_MIDIA, { faixaAtualId, tocando, posicaoSegundos, modoLoop, atualizadoEm, volume });
  });

  const aplicarRemoto = async () => {
    const { data, error } = await cliente.from('midia_estado').select('*').eq('id', ID_MIDIA).maybeSingle();
    if (error || !data) return;
    const patch = paraEstadoMidia(data as Linha);
    aplicandoRemotoContagem++;
    try {
      useStore.setState((s) => ({ midia: { ...s.midia, ...patch } }));
    } finally {
      aplicandoRemotoContagem--;
    }
  };

  // busca inicial — recupera o estado ao vivo se o GM recarregar a página no meio de uma faixa.
  void aplicarRemoto();

  const canal: ReturnType<Cliente['channel']> = cliente
    .channel('midia-estado-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'midia_estado' }, () => {
      void aplicarRemoto();
    })
    .subscribe(assinarStatusCanal('midia-estado-sync'));

  return () => {
    unsubscribeLocal();
    desconectarCanal('midia-estado-sync');
    cliente.removeChannel(canal);
  };
}
