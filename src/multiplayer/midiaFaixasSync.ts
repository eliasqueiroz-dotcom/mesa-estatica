import type { FaixaMidia } from '../state/types';
import { supabase } from '../lib/supabaseClient';
import { assinarStatusCanal, desconectarCanal } from '../lib/statusMesa';
import { useStore } from '../state/store';
import { criarDebouncePorChave } from './debounce';
import { executarComRetentativa, resolverPendencia, retomarPendenciasPersistidas } from './filaPendencias';
import { computarDiffFaixas } from './midiaFaixasDiff';
import { eraRemocaoExplicita } from './remocaoExplicita';

const PREFIXO_DELETE = 'delete:';

/** Mesmo padrão de `resolverReplayToken` em `tokensSync.ts`. */
export function resolverReplayFaixa(chave: string, faixas: FaixaMidia[]): FaixaMidia | 'apagar' | null {
  if (chave.startsWith(PREFIXO_DELETE)) return 'apagar';
  return faixas.find((f) => f.id === chave) ?? null;
}

/** Reordenar/adicionar/remover não é um arrasto contínuo — mesmo valor de fichas/npcs, não
 *  precisa do 150ms mais curto de `tokensSync.ts`. */
const ATRASO_PUSH_MS = 500;

export interface LinhaFaixa {
  id: string;
  nome: string;
  storage_path: string;
  url: string;
  ordem: number;
  criado_em: string;
}

export const paraLinha = (f: FaixaMidia): LinhaFaixa => ({
  id: f.id,
  nome: f.nome,
  storage_path: f.path,
  url: f.url,
  ordem: f.ordem,
  criado_em: f.criadoEm,
});

export const paraFaixa = (r: LinhaFaixa): FaixaMidia => ({
  id: r.id,
  nome: r.nome,
  path: r.storage_path,
  url: r.url,
  ordem: r.ordem,
  criadoEm: r.criado_em,
});

/**
 * Sincroniza `midia.faixas` — a playlist do jukebox (aba Mídia, escopo confirmado: só o
 * tocador de áudio, não a galeria de imagens/pastas GM-Geral que o doc descreve em outro
 * lugar). Mesmo padrão de `tokensSync.ts`: tabela sem dono, sync por diff, GM push + pull,
 * jogador só lê (`hidratacaoJogador.ts`).
 */
export function iniciarSyncMidiaFaixas(): () => void {
  const cliente = supabase;
  if (!cliente) return () => {};

  let aplicandoRemoto = false;
  let faixasAnteriores = useStore.getState().midia.faixas;
  const pendencias = new Set<string>();

  cliente
    .from('midia_faixas')
    .select('*')
    .order('ordem', { ascending: true })
    .then(({ data, error }) => {
      if (error || !data) return;
      aplicandoRemoto = true;
      try {
        useStore.setState((s) => ({ midia: { ...s.midia, faixas: (data as LinhaFaixa[]).map(paraFaixa) } }));
      } finally {
        faixasAnteriores = useStore.getState().midia.faixas;
        aplicandoRemoto = false;
      }
    });

  const agendarUpsert = criarDebouncePorChave<FaixaMidia>(ATRASO_PUSH_MS, (_id, faixa) => {
    pendencias.delete(_id);
    executarComRetentativa('midia-faixas-sync', faixa.id, () =>
      cliente.from('midia_faixas').upsert(paraLinha(useStore.getState().midia.faixas.find((f) => f.id === faixa.id) ?? faixa)),
    );
  });

  const unsubscribeLocal = useStore.subscribe((state, prevState) => {
    if (aplicandoRemoto || state.midia.faixas === prevState.midia.faixas) return;

    const { upserts, removidos } = computarDiffFaixas(faixasAnteriores, state.midia.faixas);
    faixasAnteriores = state.midia.faixas;

    for (const faixa of upserts) {
      pendencias.add(faixa.id);
      agendarUpsert(faixa.id, faixa);
    }
    // só apaga no servidor se o botão "excluir" marcou o id de propósito — ver
    // remocaoExplicita.ts.
    for (const id of removidos) {
      if (!eraRemocaoExplicita(id)) continue;
      executarComRetentativa('midia-faixas-sync', `${PREFIXO_DELETE}${id}`, () => cliente.from('midia_faixas').delete().eq('id', id));
    }
  });

  // reenvia o que ficou pendente de uma sessão anterior — relê a store ATUAL.
  for (const chave of retomarPendenciasPersistidas('midia-faixas-sync')) {
    const replay = resolverReplayFaixa(chave, useStore.getState().midia.faixas);
    if (replay === 'apagar') {
      const id = chave.slice(PREFIXO_DELETE.length);
      executarComRetentativa('midia-faixas-sync', chave, () => cliente.from('midia_faixas').delete().eq('id', id));
    } else if (replay) {
      executarComRetentativa('midia-faixas-sync', chave, () => cliente.from('midia_faixas').upsert(paraLinha(replay)));
    } else {
      resolverPendencia('midia-faixas-sync', chave);
    }
  }

  const canal = cliente
    .channel('midia-faixas-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'midia_faixas' }, (payload) => {
      aplicandoRemoto = true;
      try {
        const s = useStore.getState();
        if (payload.eventType === 'DELETE') {
          const idRemovido = (payload.old as { id: string }).id;
          if (pendencias.has(idRemovido)) return;
          useStore.setState({ midia: { ...s.midia, faixas: s.midia.faixas.filter((f) => f.id !== idRemovido) } });
        } else {
          const faixa = paraFaixa(payload.new as LinhaFaixa);
          if (pendencias.has(faixa.id)) return;
          const existe = s.midia.faixas.some((f) => f.id === faixa.id);
          const faixas = existe
            ? s.midia.faixas.map((f) => (f.id === faixa.id ? faixa : f))
            : [...s.midia.faixas, faixa];
          useStore.setState({ midia: { ...s.midia, faixas } });
        }
      } finally {
        faixasAnteriores = useStore.getState().midia.faixas;
        aplicandoRemoto = false;
      }
    })
    .subscribe(assinarStatusCanal('midia-faixas-sync'));

  return () => {
    unsubscribeLocal();
    desconectarCanal('midia-faixas-sync');
    cliente.removeChannel(canal);
  };
}
