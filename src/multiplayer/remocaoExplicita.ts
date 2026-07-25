/**
 * Achado ao vivo em 25/07: `fichasSync.ts`/`npcsSync.ts`/`tokensSync.ts`/`midiaFaixasSync.ts`
 * inferiam "isso foi removido" comparando a lista local atual com um snapshot anterior — se
 * QUALQUER sessão conectada como mestre (o `GM_TOKEN` é compartilhado, dá pra vincular em
 * mais de uma aba/dispositivo ao mesmo tempo) tivesse uma lista local desatualizada (aba em
 * segundo plano que perdeu o Realtime, recarregamento em timing ruim, etc.), a PRÓXIMA edição
 * qualquer nela reinterpretava "um item que essa aba não conhece" como "foi apagado" e
 * disparava um DELETE de verdade no servidor — apagando pra todo mundo uma ficha/NPC/token
 * que outra sessão tinha acabado de criar. Reproduzido: criar um segundo personagem, ele
 * sumiu do banco minutos depois sem nenhuma ação do usuário.
 *
 * Fix: exclusão só propaga pro servidor quando o próprio botão "remover" da UI marcou o id
 * aqui primeiro — nunca por inferência de diff. Um id que só "sumiu" da lista local (por
 * qualquer outro motivo) é ignorado pelo sync — a lista do servidor continua a fonte de
 * verdade e o próximo fetch/Realtime corrige a visão local, sem apagar nada de ninguém.
 */
const idsRemovidosExplicitamente = new Set<string>();

export function marcarRemocaoExplicita(id: string): void {
  idsRemovidosExplicitamente.add(id);
}

/** Consome a marca (side-effect: remove do set) — cada sync module só deve perguntar uma vez
 *  por id removido, no momento em que decide se propaga o DELETE ou não. */
export function eraRemocaoExplicita(id: string): boolean {
  const era = idsRemovidosExplicitamente.has(id);
  idsRemovidosExplicitamente.delete(id);
  return era;
}
