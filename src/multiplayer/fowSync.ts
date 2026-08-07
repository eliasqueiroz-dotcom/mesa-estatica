import { supabase } from '../lib/supabaseClient';
import { assinarStatusCanal, desconectarCanal } from '../lib/statusMesa';
import { useStore } from '../state/store';
import type { EstadoFoW, RegiaoFoW, ZonaFoW } from '../state/types';

type Cliente = NonNullable<typeof supabase>;

const ID_FOW = 'fow';

/** Linha do banco — mesmas colunas da migration 0027. Todos os campos jsonb são tipados aqui. */
interface LinhaFow {
  id: string;
  vistas: RegiaoFoW[];
  visiveis_agora: RegiaoFoW[];
  proximo_id_zona: ZonaFoW | null;
  version: number;
}

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
      const fow: EstadoFoW = {
        vistas: Array.isArray(linha.vistas) ? linha.vistas : [],
        visiveisAgora: Array.isArray(linha.visiveis_agora) ? linha.visiveis_agora : [],
        proximoIdZona: linha.proximo_id_zona ?? null,
      };
      useStore.setState((s) => ({ mapa: { ...s.mapa, fow } }));
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
    const f = state.mapa.fow;
    void cliente
      .from('fow_estado')
      .upsert({
        id: ID_FOW,
        vistas: f.vistas,
        visiveis_agora: f.visiveisAgora,
        proximo_id_zona: f.proximoIdZona,
      })
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