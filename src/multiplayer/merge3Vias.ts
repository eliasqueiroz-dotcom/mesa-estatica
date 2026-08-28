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
export function mesclar3Vias<T extends object>(baseline: T, local: T, remoto: T): T {
  const resultado: T = { ...remoto };
  (Object.keys(local) as (keyof T)[]).forEach((chave) => {
    if (local[chave] !== baseline[chave]) resultado[chave] = local[chave];
  });
  return resultado;
}
