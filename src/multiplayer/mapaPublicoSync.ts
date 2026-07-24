import { supabase } from '../lib/supabaseClient';
import { useStore } from '../state/store';
import type { GradeMapa } from '../state/types';

type Cliente = NonNullable<typeof supabase>;

const ID_MAPA = 'mapa';

interface Linha {
  id: string;
  imagem_data_url: string | null;
  grade: GradeMapa;
}

/**
 * Sincroniza só o fundo do mapa (`imagemDataUrl`/`grade`) via a linha singleton
 * `mapa_publico` — mesmo padrão de `sessaoPublicaSync.ts`. `mapa.tokens` fica de fora de
 * propósito, isso já é `tokensSync.ts` (tabela própria, desde a Fase A).
 *
 * Só o GM escreve (RLS `mapa_publico_update_gm`/`insert_gm`); o jogador só lê, via
 * `useMapaPublico` em `hidratacaoJogador.ts`.
 */
export function iniciarSyncMapaPublico(): () => void {
  const cliente = supabase;
  if (!cliente) return () => {};

  let aplicandoRemotoContagem = 0;

  const unsubscribeLocal = useStore.subscribe((state, prevState) => {
    if (aplicandoRemotoContagem > 0) return;
    if (state.mapa.imagemDataUrl === prevState.mapa.imagemDataUrl && state.mapa.grade === prevState.mapa.grade) return;
    cliente
      .from('mapa_publico')
      .upsert({ id: ID_MAPA, imagem_data_url: state.mapa.imagemDataUrl, grade: state.mapa.grade })
      .then(({ error }) => {
        if (error) console.error('[mapaPublicoSync] push falhou', error);
      });
  });

  const aplicarRemoto = async () => {
    const { data, error } = await cliente.from('mapa_publico').select('*').eq('id', ID_MAPA).maybeSingle();
    if (error || !data) return;
    const linha = data as Linha;
    aplicandoRemotoContagem++;
    try {
      useStore.setState((s) => ({ mapa: { ...s.mapa, imagemDataUrl: linha.imagem_data_url, grade: linha.grade } }));
    } finally {
      aplicandoRemotoContagem--;
    }
  };

  // busca inicial (mesmo motivo do fix em tokensSync.ts/fichasSync.ts) — sem linha ainda é no-op.
  void aplicarRemoto();

  const canal: ReturnType<Cliente['channel']> = cliente
    .channel('mapa-publico-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mapa_publico' }, () => {
      void aplicarRemoto();
    })
    .subscribe();

  return () => {
    unsubscribeLocal();
    cliente.removeChannel(canal);
  };
}
