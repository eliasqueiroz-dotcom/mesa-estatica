import type { BasePV } from './data/dificuldades';

export function calcularPvMaximo(basePV: BasePV, vigor: number): number {
  return basePV + 5 * vigor;
}

export function calcularSanidadeMaxima(vontade: number): number {
  return 10 + 5 * vontade;
}

export function calcularDefesa(agilidade: number, modificadorEquipamento: number): number {
  return 10 + agilidade + modificadorEquipamento;
}

export function calcularAlerta(percepcao: number): number {
  return 10 + percepcao;
}

/** Metade do máximo, arredondada pra baixo — a "linha" usada por Ferido e pelo cruzamento de Sanidade. */
export function metade(valorMaximo: number): number {
  return Math.floor(valorMaximo / 2);
}

/** PV atual <= metade do máximo → -2 em testes de Vigor e Agilidade (regras.md). */
export function estaFerido(pvAtual: number, pvMaximo: number): boolean {
  return pvAtual <= metade(pvMaximo);
}

/** Detecta a TRANSIÇÃO (não o estado) — só dispara no instante em que a Sanidade cruza a linha descendo. */
export function cruzouLinhaDescendo(anterior: number, atual: number, linha: number): boolean {
  return anterior > linha && atual <= linha;
}

/** Perder 5 ou mais de Sanidade numa única alteração dispara Surto (regras.md, Parte IV). */
export function perdeuCincoOuMaisDeUmaVez(anterior: number, atual: number): boolean {
  return anterior - atual >= 5;
}
