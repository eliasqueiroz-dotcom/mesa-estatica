/**
 * Teste de Sanidade: diante de um gatilho, teste de Vontade vs. DT da cena.
 * Falha: perde o valor inteiro rolado. Sucesso: perde metade (arredondada pra baixo,
 * mesma convenção da linha de Sanidade em derivados.ts — regras.md não especifica arredondamento).
 */
export function calcularPerdaSanidade(valorRolado: number, sucessoNoTeste: boolean): number {
  return sucessoNoTeste ? Math.floor(valorRolado / 2) : valorRolado;
}
