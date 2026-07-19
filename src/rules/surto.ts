import { TABELA_SURTO, type EntradaSurto } from './data/surto';

export interface ResultadoSurto {
  d20A: number;
  d20B: number;
  entradaA: EntradaSurto;
  entradaB: EntradaSurto;
  /** "o destino insiste" — os dois d20 bateram no mesmo número, sem escolha. */
  mesmoNumero: boolean;
}

/** Surto rola 1d20 duas vezes; o jogador escolhe qual acontece, exceto empate (regras.md, Parte IV). */
export function resolverSurto(d20A: number, d20B: number): ResultadoSurto {
  const entradaA = TABELA_SURTO.find((e) => e.d20 === d20A)!;
  const entradaB = TABELA_SURTO.find((e) => e.d20 === d20B)!;
  return { d20A, d20B, entradaA, entradaB, mesmoNumero: d20A === d20B };
}
