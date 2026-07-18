export type NivelDificuldade = 'facil' | 'media' | 'dificil' | 'extrema' | 'custom';

export const DIFICULDADES: { id: NivelDificuldade; nome: string; dt: number | null }[] = [
  { id: 'facil', nome: 'Fácil', dt: 10 },
  { id: 'media', nome: 'Média', dt: 15 },
  { id: 'dificil', nome: 'Difícil', dt: 20 },
  { id: 'extrema', nome: 'Extrema', dt: 25 },
  { id: 'custom', nome: 'Customizada', dt: null },
];

export type GatilhoSanidade = 'perturbador' | 'horror' | 'impossivel';

/** Dado de perda por gatilho de Sanidade (regras.md, Parte IV). */
export const PERDA_SANIDADE: { id: GatilhoSanidade; nome: string; dado: string }[] = [
  { id: 'perturbador', nome: 'Perturbador', dado: '1d4' },
  { id: 'horror', nome: 'Horror direto', dado: '1d8' },
  { id: 'impossivel', nome: 'O impossível', dado: '2d8' },
];

/** Bases de PV configuráveis — "dial de letalidade" da sessão zero. Padrão: 20. */
export const BASES_PV = [10, 20, 30] as const;
export type BasePV = (typeof BASES_PV)[number];
