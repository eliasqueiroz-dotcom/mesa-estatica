import type { TipoRegulador } from '../state/types';

/** Acessos que a telemetria acumula por dose (regras.md, Parte IV — "o mestre gasta na pior hora"). */
export const ACESSOS_POR_TIPO: Record<TipoRegulador, number> = {
  generico: 0,
  pleno: 1,
  ajuste: 3,
};

/** Dependência: dose em duas sessões consecutivas. */
export function estaDependente(sessoesComDose: number[], sessaoAtual: number): boolean {
  const set = new Set(sessoesComDose);
  return set.has(sessaoAtual) && set.has(sessaoAtual - 1);
}
