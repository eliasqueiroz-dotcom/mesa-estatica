/**
 * Merge raso de 3 vias por chave de nível superior — achado ao vivo em 28/08: dois editores
 * concorrentes na MESMA ficha (mestre ajustando PV em "status do grupo" enquanto o jogador
 * edita armas, ou duas abas do mestre) faziam o push de quem "perdia a corrida" apagar o campo
 * que o outro tinha acabado de confirmar — `empurrarFicha` reescrevia o objeto/linha inteira a
 * cada push, sem noção de "o que mudou desde a última vez que os dois lados bateram".
 *
 * `baseline` = última vez que este cliente sabia que local e remoto coincidiam (ou o valor que
 * ele mesmo acabou de escrever). Campo em que `local` diverge do `baseline` foi tocado por
 * ESTE cliente desde então — vence. Campo em que `local` ainda bate com o `baseline` não foi
 * tocado aqui — usa o `remoto` mais fresco (pode ter sido mudado por outro editor nesse
 * meio-tempo). Reproduzido e confirmado ao vivo contra o Supabase de dev antes deste fix:
 * sem merge, a arma que o jogador tinha acabado de salvar sumia assim que o mestre confirmava
 * qualquer outra edição concorrente na mesma ficha.
 */
/** Compara por VALOR, não por referência — `baseline` vem de `empurrarFicha` (fichasSync.ts),
 *  que a cada push reconstrói o baseline a partir do dado que acabou de gravar no Postgres
 *  (JSON recém-parseado da resposta, pra armas/pericias/traumas/surtosAtivos etc.), uma
 *  referência DIFERENTE do array/objeto ainda vivo na store Zustand mesmo quando o conteúdo é
 *  idêntico. Comparar por `!==` reference fazia campo intocado ser marcado como "editado
 *  localmente" a partir do 2º push em diante, reintroduzindo — só pra campos objeto/array — o
 *  mesmo bug de sobrescrita silenciosa que este merge existe pra evitar (achado 29/08, ver
 *  merge3Vias.test.ts pro repro). Campos primitivos batem por `===` de qualquer jeito;
 *  `JSON.stringify` cobre objeto/array sem precisar de uma lib de deep-equal.
 */
function igual(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

export function mesclar3Vias<T extends object>(baseline: T, local: T, remoto: T): T {
  const resultado: T = { ...remoto };
  (Object.keys(local) as (keyof T)[]).forEach((chave) => {
    if (!igual(local[chave], baseline[chave])) resultado[chave] = local[chave];
  });
  return resultado;
}
