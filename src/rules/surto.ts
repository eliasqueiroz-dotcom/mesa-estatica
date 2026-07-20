import { TABELA_SURTO, type EntradaSurto } from './data/surto';

export interface ResultadoSurto {
  d20A: number;
  d20B: number;
  entradaA: EntradaSurto;
  entradaB: EntradaSurto;
  /** "o destino insiste" — os dois d20 bateram no mesmo número, sem escolha. */
  mesmoNumero: boolean;
}

export interface EstadoSessaoParaSurto {
  modoCombate: boolean;
  contadorCena: number;
  rodada: number;
}

/** Surto rola 1d20 duas vezes; o jogador escolhe qual acontece, exceto empate (regras.md, Parte IV). */
export function resolverSurto(d20A: number, d20B: number): ResultadoSurto {
  const entradaA = TABELA_SURTO.find((e) => e.d20 === d20A)!;
  const entradaB = TABELA_SURTO.find((e) => e.d20 === d20B)!;
  return { d20A, d20B, entradaA, entradaB, mesmoNumero: d20A === d20B };
}

/** Calcula o valor a armazenar em `ficha.surtoAtivo` quando o Surto dispara.
 *  Fora de combate: armazena `contadorCena` (vigora até avançar cena).
 *  Em combate: armazena `rodada + 1d4+1` (vigora até essa rodada passar). */
export function calcularExpiraSurto(sessao: EstadoSessaoParaSurto): number {
  if (sessao.modoCombate) {
    return sessao.rodada + (Math.floor(Math.random() * 4) + 1);
  }
  return sessao.contadorCena;
}

/** Verifica se a ficha está em Surto ativo, considerando o modo combate.
 *  Fora de combate: surtoAtivo === contadorCena.
 *  Em combate: surtoAtivo >= rodada (expira quando a rodada ultrapassa). */
export function personagemEstaEmSurto(
  surtoAtivo: number | null,
  sessao: EstadoSessaoParaSurto,
): boolean {
  if (surtoAtivo === null) return false;
  if (sessao.modoCombate) {
    return surtoAtivo >= sessao.rodada;
  }
  return surtoAtivo === sessao.contadorCena;
}
