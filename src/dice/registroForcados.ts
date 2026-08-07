/**
 * Ponte neutra entre quem ROLA e a fila de valores forçados do mestre (`forcarRolagem.ts`).
 *
 * Existe por uma restrição de bundle: `forcarRolagem.ts` abre um `BroadcastChannel` no
 * top-level e pede o estado da fila ao carregar, então não pode entrar no bundle do jogador —
 * mas os pontos que precisam consultar a fila (`state/store.ts`, `rules/surto.ts`,
 * `rules/npcAcoes.ts`, `ArmasSection.tsx`) entram. Um import direto vazaria a fila secreta pro
 * app do jogador; uma referência de código não é tree-shakeável.
 *
 * Este módulo é seguro em qualquer bundle: nenhum side-effect, nenhum canal, só uma variável.
 * O bundle do mestre chama `registrarConsumidorForcados(consumirForcados)` no boot
 * (`entries/mestre.tsx`); no do jogador ninguém registra e o consumidor segue sendo o no-op,
 * então toda rolagem lá é honesta por construção — não por disciplina de quem escreve o código.
 *
 * Mesmo motivo do parâmetro injetável que `useDiceBox.ts` já usa; a diferença é que aqui a
 * injeção precisa ser global, porque quem rola é o store (Zustand vanilla, sem React) e módulos
 * de regra puros, que não recebem props.
 */

/** Categoria da rolagem, pro mestre amarrar um valor forçado ao momento certo.
 *  `qualquer` só existe do lado da ENTRADA da fila (casa com toda rolagem); uma rolagem sempre
 *  se declara com um tipo concreto. */
export type TipoRolagemForcada = 'qualquer' | 'teste' | 'iniciativa' | 'dano' | 'sanidade' | 'surto';

export type ConsumirForcadosFn = (
  totalDados: number,
  personagemId: string | null,
  tipo: TipoRolagemForcada,
) => number[] | null;

const semForcados: ConsumirForcadosFn = () => null;

let consumidor: ConsumirForcadosFn = semForcados;

/** Só o bundle do mestre chama isto (ver `entries/mestre.tsx`). */
export function registrarConsumidorForcados(fn: ConsumirForcadosFn): void {
  consumidor = fn;
}

/** Volta ao no-op — usado em teste pra não vazar fila entre casos. */
export function limparConsumidorForcados(): void {
  consumidor = semForcados;
}

export function consumirForcadosRegistrado(
  totalDados: number,
  personagemId: string | null,
  tipo: TipoRolagemForcada,
): number[] | null {
  return consumidor(totalDados, personagemId, tipo);
}

/**
 * Rola `qtd` dados de `lados` faces respeitando a fila do mestre — honesto quando a fila não
 * tem nada que case. É o que os pontos fora da bandeja 3D devem usar no lugar de `Math.random`
 * direto; a bandeja tem o caminho próprio (`useDiceBox.montarNotacao`, que precisa dos valores
 * ANTES de rolar pra lib fazer o swap da face).
 */
export function rolarDadosComForcados(
  qtd: number,
  lados: number,
  personagemId: string | null,
  tipo: TipoRolagemForcada,
): number[] {
  const forcados = consumirForcadosRegistrado(qtd, personagemId, tipo);
  const valores: number[] = [];
  for (let i = 0; i < qtd; i++) {
    valores.push(forcados?.[i] ?? Math.floor(Math.random() * lados) + 1);
  }
  return valores;
}

/** Atalho pro caso de um dado só. */
export function rolarDadoComForcados(
  lados: number,
  personagemId: string | null,
  tipo: TipoRolagemForcada,
): number {
  return rolarDadosComForcados(1, lados, personagemId, tipo)[0];
}
