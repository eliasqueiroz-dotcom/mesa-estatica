/**
 * `empurrarFicha`/`empurrarNpc` decidem INSERT vs UPDATE checando existência com um `SELECT`
 * antes — não é atômico. Duas escritas quase simultâneas pro MESMO id novo (ex.: o push
 * debounçado normal e um replay de `retomarPendenciasPersistidas` reagindo à mesma edição, ou
 * duas abas de mestre) podem ambas ver "não existe" e ambas tentar INSERT; a segunda esbarra em
 * `23505 duplicate key`. Reproduzido ao vivo em 23/08 (`characters_privado_pkey`), ficou preso
 * na fila de retry até um reload resolver sozinho.
 *
 * Em vez de trocar por `upsert` puro (não dá: `characters_privado.owner_token` só pode ser
 * escrito na criação de verdade — um upsert normal reescreveria/invalidaria o token do jogador
 * em toda edição seguinte), trata o 23505 como sinal de "alguém te venceu, é UPDATE agora" — cai
 * pro update sem propagar o erro. Qualquer outro código de erro segue sendo um erro de verdade.
 */
const CODIGO_CHAVE_DUPLICADA = '23505';

export async function inserirOuAtualizarNaCorrida(
  inserir: () => PromiseLike<{ error: { code?: string } | null }>,
  atualizar: () => PromiseLike<{ error: unknown }>,
): Promise<void> {
  const { error } = await inserir();
  if (!error) return;
  if (error.code !== CODIGO_CHAVE_DUPLICADA) throw error;
  const { error: erroUpdate } = await atualizar();
  if (erroUpdate) throw erroUpdate;
}
