export type Atributo = 'vigor' | 'agilidade' | 'intelecto' | 'percepcao' | 'presenca' | 'vontade';

export type GrauPericia = 0 | 3 | 6; // nenhum · Treinado · Veterano

export interface DefinicaoPericia {
  id: string;
  nome: string;
  atributo: Atributo;
}

/** As 15 perícias oficiais (regras.md) — Erudição existe, o plano original a omitia. */
export const PERICIAS: DefinicaoPericia[] = [
  { id: 'atletismo', nome: 'Atletismo', atributo: 'vigor' },
  { id: 'briga', nome: 'Briga', atributo: 'vigor' },
  { id: 'pontaria', nome: 'Pontaria', atributo: 'agilidade' },
  { id: 'furtividade', nome: 'Furtividade', atributo: 'agilidade' },
  { id: 'conducao', nome: 'Condução', atributo: 'agilidade' },
  { id: 'tecnologia', nome: 'Tecnologia', atributo: 'intelecto' },
  { id: 'medicina', nome: 'Medicina', atributo: 'intelecto' },
  { id: 'erudicao', nome: 'Erudição', atributo: 'intelecto' },
  { id: 'ocultismo', nome: 'Ocultismo', atributo: 'intelecto' },
  { id: 'investigacao', nome: 'Investigação', atributo: 'percepcao' },
  { id: 'intuicao', nome: 'Intuição', atributo: 'percepcao' },
  { id: 'rua', nome: 'Rua', atributo: 'percepcao' },
  { id: 'persuasao', nome: 'Persuasão', atributo: 'presenca' },
  { id: 'enganacao', nome: 'Enganação', atributo: 'presenca' },
  { id: 'intimidacao', nome: 'Intimidação', atributo: 'presenca' },
];

export const ATRIBUTOS: { id: Atributo; nome: string }[] = [
  { id: 'vigor', nome: 'Vigor' },
  { id: 'agilidade', nome: 'Agilidade' },
  { id: 'intelecto', nome: 'Intelecto' },
  { id: 'percepcao', nome: 'Percepção' },
  { id: 'presenca', nome: 'Presença' },
  { id: 'vontade', nome: 'Vontade' },
];
