import type { FaixaMidia } from '../state/types';
import { supabase } from '../lib/supabaseClient';
import { useStore } from '../state/store';
import { criarDebouncePorChave } from './debounce';
import { computarDiffFaixas } from './midiaFaixasDiff';

/** Reordenar/adicionar/remover não é um arrasto contínuo — mesmo valor de fichas/npcs, não
 *  precisa do 150ms mais curto de `tokensSync.ts`. */
const ATRASO_PUSH_MS = 400;

export interface LinhaFaixa {
  id: string;
  nome: string;
  storage_path: string;
  url: string;
  ordem: number;
  criado_em: string;
}

const paraLinha = (f: FaixaMidia): LinhaFaixa => ({
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
    cliente
      .from('midia_faixas')
      .upsert(paraLinha(faixa))
      .then(({ error }) => {
        if (error) console.error('[midiaFaixasSync] upsert falhou', error);
      });
  });

  const unsubscribeLocal = useStore.subscribe((state, prevState) => {
    if (aplicandoRemoto || state.midia.faixas === prevState.midia.faixas) return;

    const { upserts, removidos } = computarDiffFaixas(faixasAnteriores, state.midia.faixas);
    faixasAnteriores = state.midia.faixas;

    for (const faixa of upserts) agendarUpsert(faixa.id, faixa);
    for (const id of removidos) {
      cliente
        .from('midia_faixas')
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.error('[midiaFaixasSync] delete falhou', error);
        });
    }
  });

  const canal = cliente
    .channel('midia-faixas-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'midia_faixas' }, (payload) => {
      aplicandoRemoto = true;
      try {
        const s = useStore.getState();
        if (payload.eventType === 'DELETE') {
          const idRemovido = (payload.old as { id: string }).id;
          useStore.setState({ midia: { ...s.midia, faixas: s.midia.faixas.filter((f) => f.id !== idRemovido) } });
        } else {
          const faixa = paraFaixa(payload.new as LinhaFaixa);
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
    .subscribe();

  return () => {
    unsubscribeLocal();
    cliente.removeChannel(canal);
  };
}
