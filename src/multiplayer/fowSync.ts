import { supabase } from '../lib/supabaseClient';
import { assinarStatusCanal, desconectarCanal } from '../lib/statusMesa';
import { useStore } from '../state/store';
import type { EstadoFoW, RegiaoFoW, ZonaFoW } from '../state/types';

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

  const aplicarRemoto = async () => {
    const { data, error } = await cliente.from('fow_estado').select('*').eq('id', ID_FOW).maybeSingle();
    if (error || !data) return;
    const linha = data as LinhaFow;
    aplicandoRemotoContagem++;
    try {
      useStore.setState((s) => ({ mapa: { ...s.mapa, fow: paraEstadoFoW(linha) } }));
    } finally {
      aplicandoRemotoContagem--;
    }
  };

  // busca inicial — sem linha ainda é no-op (mesa sem FoW configurado).
  void aplicarRemoto();

  const canal: ReturnType<Cliente['channel']> = cliente
    .channel('fow-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'fow_estado' }, () => {
      void aplicarRemoto();
    })
    .subscribe(assinarStatusCanal('fow-sync'));

  // Push local → remoto. Compara por referência de objeto (imutável por troca — ver acima).
  const unsubscribeLocal = useStore.subscribe((state, prevState) => {
    if (aplicandoRemotoContagem > 0) return;
    if (state.mapa.fow === prevState.mapa.fow) return;
    void cliente
      .from('fow_estado')
      .upsert({ id: ID_FOW, ...paraLinha(state.mapa.fow) })
      .then(({ error }) => {
        if (error) console.error('[fowSync] push falhou', error);
      });
  });

  return () => {
    unsubscribeLocal();
    desconectarCanal('fow-sync');
    cliente.removeChannel(canal);
  };
}