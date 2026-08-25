import { supabase } from '../lib/supabaseClient';
import { assinarStatusCanalComRefetch, desconectarCanal } from '../lib/statusMesa';
import { useStore } from '../state/store';
import { criarDebouncePorChave } from './debounce';
import { executarComRetentativa, marcarEmVoo, retomarPendenciasPersistidas } from './filaPendencias';
import { ehDataUrl } from './imagemPendente';
import type { GradeMapa } from '../state/types';

type Cliente = NonNullable<typeof supabase>;

const ID_MAPA = 'mapa';

/** Mesmo valor de `fichasSync.ts`/`npcsSync.ts` — junta a rajada de `pointermove` de um
 *  arrasto de grid (dezenas por segundo, `MapaTab.tsx`) numa escrita só. Sem isso, cada
 *  micro-ajuste da grade reenviava a imagem do mapa inteira (base64) pro Postgres e, por
 *  Realtime, pra tela de cada jogador conectado — o item que mais pesou no egress do projeto
 *  (ver investigação de 08/08). Enquanto a imagem não migra pra Supabase Storage (planejado em
 *  mesa-estatica-multiplayer-completo.md, ainda não feito), o debounce é o que evita o
 *  sangramento durante o uso normal. */
const ATRASO_PUSH_MS = 500;

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

  const aplicarLinha = (linha: Linha) => {
    aplicandoRemotoContagem++;
    try {
      // merge, não substituição: uma linha antiga no banco (de antes de `escala`/`unidade`
      // existirem em GradeMapa) não pode apagar os defaults locais desses campos.
      useStore.setState((s) => ({ mapa: { ...s.mapa, imagemDataUrl: linha.imagem_data_url, grade: { ...s.mapa.grade, ...linha.grade } } }));
    } finally {
      aplicandoRemotoContagem--;
    }
  };

  // `imagemDataUrl` ainda em base64 (upload pro Storage em voo) nunca vai pro Postgres/Realtime
  // — ver imagemPendente.ts. Omite a coluna (upsert preserva o valor remoto anterior); a
  // próxima mudança, quando o upload virar URL, sincroniza de verdade.
  const push = () => {
    const { imagemDataUrl, grade } = useStore.getState().mapa;
    const pendente = ehDataUrl(imagemDataUrl);
    return cliente.from('mapa_publico').upsert({ id: ID_MAPA, ...(pendente ? {} : { imagem_data_url: imagemDataUrl }), grade });
  };

  const agendarPush = criarDebouncePorChave<{ imagemDataUrl: string | null; grade: GradeMapa }>(ATRASO_PUSH_MS, () => {
    executarComRetentativa('mapa-publico-sync', ID_MAPA, push);
  });

  const unsubscribeLocal = useStore.subscribe((state, prevState) => {
    if (aplicandoRemotoContagem > 0) return;
    if (state.mapa.imagemDataUrl === prevState.mapa.imagemDataUrl && state.mapa.grade === prevState.mapa.grade) return;
    // marca ANTES de agendar — sem isso, a janela do próprio debounce fica sem rede de
    // segurança nenhuma (ver `marcarEmVoo` em filaPendencias.ts).
    marcarEmVoo('mapa-publico-sync', ID_MAPA);
    agendarPush(ID_MAPA, { imagemDataUrl: state.mapa.imagemDataUrl, grade: state.mapa.grade });
  });

  // reenvia se ficou pendente de uma sessão anterior — singleton, chave sempre ID_MAPA.
  if (retomarPendenciasPersistidas('mapa-publico-sync').length > 0) {
    executarComRetentativa('mapa-publico-sync', ID_MAPA, push);
  }

  // busca inicial E refetch de reconexão (canal caiu e voltou, mesmo motivo do fix em
  // tokensSync.ts/fichasSync.ts) — sem linha ainda é no-op. Reconexão precisa refazer esse
  // fetch porque o Realtime não reenvia o evento perdido durante a queda.
  const refetchMapaPublico = () =>
    cliente
      .from('mapa_publico')
      .select('*')
      .eq('id', ID_MAPA)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) return;
        aplicarLinha(data as Linha);
      });
  void refetchMapaPublico();

  const canal: ReturnType<Cliente['channel']> = cliente
    .channel('mapa-publico-sync')
    // usa o payload que o próprio evento já traz — evita um segundo download da imagem via
    // `select('*')' a cada mudança (a linha inteira já vem no `postgres_changes`, refazer a
    // busca dobrava o tráfego da mesma imagem sem necessidade).
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mapa_publico' }, (payload) => {
      const linha = payload.new as Linha | null;
      if (!linha) return;
      aplicarLinha(linha);
    })
    .subscribe(assinarStatusCanalComRefetch('mapa-publico-sync', refetchMapaPublico));

  return () => {
    unsubscribeLocal();
    desconectarCanal('mapa-publico-sync');
    cliente.removeChannel(canal);
  };
}
