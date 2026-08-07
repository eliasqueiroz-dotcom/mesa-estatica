import { supabase } from '../lib/supabaseClient';
import { useStore } from '../state/store';
import { marcarRemocaoExplicita } from './remocaoExplicita';

/**
 * "Sessão limpa" — zera a mesa inteira, local E no servidor.
 *
 * `resetarEstado()` sozinho NÃO resolve, e chamá-lo cru seria pior que não fazer nada:
 *
 * 1. Os syncs de fichas/NPCs/tokens/faixas/sons só propagam DELETE se o id foi marcado em
 *    `remocaoExplicita.ts` — um sumiço por diff é ignorado de propósito (é a invariante que
 *    impediu uma aba desatualizada de apagar a mesa dos outros). Sem marcar, as linhas ficariam
 *    órfãs no banco e, pior, **voltariam** pra lista local no próximo evento Realtime ou reload,
 *    porque `fichasSync`/`npcsSync` reconciliam o remoto de volta. O reset se desfaria sozinho.
 * 2. `rolls_publicas` não tem caminho de limpeza nenhum hoje (`logRollsSync` só insere e revela),
 *    então as rolagens da sessão anterior sobreviveriam a qualquer reset.
 *
 * Por isso a ordem aqui importa: marca tudo → reseta local (os syncs veem as marcas e propagam
 * os DELETEs no mesmo tick) → limpa à mão o que o diff não cobre.
 *
 * Fora do alcance, de propósito: os arquivos no bucket de Storage (só as linhas de
 * `midia_faixas`/`soundpad_sons` somem, os mp3 ficam lá) e as tabelas de auditoria
 * (`vinculo_jogador_log`, `mestre_tentativas`) — auditoria que some com um clique não é auditoria.
 */
export async function resetarMesaCompleta(): Promise<void> {
  const estado = useStore.getState();

  // 1. autoriza o DELETE de cada id que os syncs vão ver sumir daqui a um tick.
  for (const ficha of estado.fichas) marcarRemocaoExplicita(ficha.id);
  for (const npc of estado.npcs) marcarRemocaoExplicita(npc.id);
  for (const token of estado.mapa.tokens) marcarRemocaoExplicita(token.id);
  for (const faixa of estado.midia.faixas) marcarRemocaoExplicita(faixa.id);
  for (const som of estado.soundpad.sons) marcarRemocaoExplicita(som.id);

  // 2. um único set() com tudo vazio — cada subscriber de sync roda uma vez e propaga.
  //    `iniciativa` e `log_publico` são apagados pelos caminhos que já existem (esses dois não
  //    têm o gate de remoção explícita), e os singletons (sessão, mapa, mídia, soundpad) voltam
  //    aos valores default pelo upsert normal de cada sync.
  estado.resetarEstado();

  // 3. o que nenhum diff cobre. `.not('id','is',null)` é a condição sempre-verdadeira que o
  //    PostgREST exige pra aceitar um delete sem filtro (mesma forma do delete de log_publico).
  //    `fow_estado` APAGADO (não só upsertado vazio): se uma mesa rodou revelações e foi
  //    resetada, a linha singleton deletada moraliza o estado; o próximo `iniciarSyncFoW` refaz
  //    a partir do nada (sem linha → no-op). `resetarEstado()` já zera localmente (`criarEstadoInicial`
  //    injeta `fow: criarFoWVazio()`), e o `fowSync` honestamente upsertaria o vazio — mas o
  //    DELETE fecha o caminho pra uma sessão velha ressurgir caso o upsert do `resetMesa`
  //    corra antes do `criarFoWVazio` ser aplicado (paranoia que casou com o histórico de
  //    "exclusão nunca por diff" — invariante #1 do ROADMAP).
  const cliente = supabase;
  if (!cliente) return;
  const [ RollsRes, FoWRes ] = await Promise.all([
    cliente.from('rolls_publicas').delete().not('id', 'is', null),
    cliente.from('fow_estado').delete().not('id', 'is', null),
  ]);
  if (RollsRes.error) console.error('[resetMesa] limpar rolls_publicas falhou', RollsRes.error);
  if (FoWRes.error) console.error('[resetMesa] limpar fow_estado falhou', FoWRes.error);
}
