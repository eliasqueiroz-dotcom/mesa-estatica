import { supabase } from '../lib/supabaseClient';
import { assinarStatusCanalComRefetch, desconectarCanal } from '../lib/statusMesa';
import { useStore } from '../state/store';
import type { EstadoFoW, RegiaoFoW, ZonaFoW } from '../state/types';
import { executarComRetentativa, retomarPendenciasPersistidas } from './filaPendencias';

type Cliente = NonNullable<typeof supabase>;

const ID_FOW = 'fow';

/** Linha do banco — mesmas colunas das migrations 0027/0028. Todos os campos jsonb são tipados
 *  aqui. `proximo_id_zona` é a coluna original (migration 0027) — o nome local mudou pra
 *  `zonaAtual` na v28 (zona virou atributo da cena, não por região), mas renomear a coluna
 *  custaria uma migration à toa: ela já guardava um único scalar por linha, sempre foi isso. */
export interface LinhaFow {
  id: string;
  vistas: RegiaoFoW[];
  visiveis_agora: RegiaoFoW[];
  proximo_id_zona: ZonaFoW | null;
  ativa: boolean | null;
  version: number;
}

export const paraLinha = (f: EstadoFoW): Omit<LinhaFow, 'id' | 'version'> => ({
  vistas: f.vistas,
  visiveis_agora: f.visiveisAgora,
  proximo_id_zona: f.zonaAtual,
  ativa: f.ativa,
});

/** `vistas`/`visiveis_agora` viram `[]` se a linha vier corrompida (não-array); `ativa` cai pra
 *  `false` se a coluna não existir ainda (banco sem a migration 0028 — mesmo princípio do
 *  fallback de `condicao_duracao` em `sessaoPublicaSync.ts`: nunca deixar undefined vazar pro
 *  estado local). */
export const paraEstadoFoW = (r: Pick<LinhaFow, 'vistas' | 'visiveis_agora' | 'proximo_id_zona' | 'ativa'>): EstadoFoW => ({
  vistas: Array.isArray(r.vistas) ? r.vistas : [],
  visiveisAgora: Array.isArray(r.visiveis_agora) ? r.visiveis_agora : [],
  zonaAtual: r.proximo_id_zona ?? null,
  ativa: r.ativa ?? false,
});

/** Hidrata `mapa.fow` a partir do estado persistente no banco (mesmo padrão de
 *  `mapaPublicoSync.ts`). Roda no mestre E no jogador — o jogador só lê, nunca publica (RLS
 *  `is_gm()` no insert/update/delete garante isso no servidor; aqui é o simétrico client-side).
 *
 *  Diferença de `mapaPublicoSync` (que sincroniza `imagemDataUrl`/`grade`): aqui são dois
 *  arrays (`vistas`/`visiveis_agora`) + um scalar (`proximo_id_zona`). A detecção de
 *  "ALTEROU e precisa pushar" compara o objeto `fow` inteiro — como `RegiaoFoW` é imutável
 *  por troca de referência (sempre que o store cria novo objeto em `adicionarRegiaoFoW`/
 *  `cobrirLuzFoW`/...), a comparação por `prevState.mapa.fow === state.mapa.fow` basta, e
 *  não reenvia em atualizações de outras chaves de `mapa` (imagem, grade, tokens). */
export function iniciarSyncFoW(): () => void {
  const cliente = supabase;
  if (!cliente) return () => {};

  let aplicandoRemotoContagem = 0;

  const aplicarLinha = (linha: LinhaFow) => {
    aplicandoRemotoContagem++;
    try {
      useStore.setState((s) => ({ mapa: { ...s.mapa, fow: paraEstadoFoW(linha) } }));
    } finally {
      aplicandoRemotoContagem--;
    }
  };

  // busca inicial E refetch de reconexão (canal caiu e voltou) — sem linha ainda é no-op (mesa
  // sem FoW configurado). Reconexão precisa do mesmo fetch: o Realtime não reenvia o evento
  // perdido durante a queda, e o payload de evento (usado abaixo, pra não reconsultar arrays
  // que só crescem) não existe fora de um evento de verdade.
  const refetchFoW = () =>
    cliente
      .from('fow_estado')
      .select('*')
      .eq('id', ID_FOW)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) return;
        aplicarLinha(data as LinhaFow);
      });
  void refetchFoW();

  const canal: ReturnType<Cliente['channel']> = cliente
    .channel('fow-sync')
    // usa o payload que o próprio evento já traz — evita reconsultar `vistas`/`visiveis_agora`
    // (arrays que crescem a cada revelação de fog-of-war) a cada mudança, mesmo padrão de
    // `mapaPublicoSync.ts`.
    .on('postgres_changes', { event: '*', schema: 'public', table: 'fow_estado' }, (payload) => {
      const linha = payload.new as LinhaFow | null;
      if (!linha) return;
      aplicarLinha(linha);
    })
    .subscribe(assinarStatusCanalComRefetch('fow-sync', refetchFoW));

  // Push local → remoto. Compara por referência de objeto (imutável por troca — ver acima).
  const unsubscribeLocal = useStore.subscribe((state, prevState) => {
    if (aplicandoRemotoContagem > 0) return;
    if (state.mapa.fow === prevState.mapa.fow) return;
    executarComRetentativa('fow-sync', ID_FOW, () =>
      cliente.from('fow_estado').upsert({ id: ID_FOW, ...paraLinha(useStore.getState().mapa.fow) }),
    );
  });

  // reenvia se ficou pendente de uma sessão anterior — singleton, então a única chave
  // possível é ID_FOW; relê a store ATUAL, não um payload congelado.
  if (retomarPendenciasPersistidas('fow-sync').length > 0) {
    executarComRetentativa('fow-sync', ID_FOW, () =>
      cliente.from('fow_estado').upsert({ id: ID_FOW, ...paraLinha(useStore.getState().mapa.fow) }),
    );
  }

  return () => {
    unsubscribeLocal();
    desconectarCanal('fow-sync');
    cliente.removeChannel(canal);
  };
}