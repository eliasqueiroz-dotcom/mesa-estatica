export interface DefinicaoArma {
  nome: string;
  dano: string;
  somaVigor: boolean;
  alcanceMetros: number;
  nota: string;
}

/** As 9 armas do guia (regras.md, Parte V). */
export const ARMAS: DefinicaoArma[] = [
  { nome: 'Desarmado', dano: '1d4', somaVigor: true, alcanceMetros: 1.5, nota: '—' },
  { nome: 'Faca', dano: '1d6', somaVigor: true, alcanceMetros: 1.5, nota: 'fácil de esconder' },
  { nome: 'Bastão / cassetete', dano: '1d8', somaVigor: true, alcanceMetros: 1.5, nota: '—' },
  { nome: 'Facão / machado', dano: '1d10', somaVigor: true, alcanceMetros: 1.5, nota: 'impossível de disfarçar' },
  { nome: 'Taser', dano: '1', somaVigor: false, alcanceMetros: 1.5, nota: 'Vigor DT 15 ou Caído e Exposto por 1 rodada' },
  { nome: 'Pistola', dano: '2d6', somaVigor: false, alcanceMetros: 20, nota: 'comum, fácil de esconder' },
  { nome: 'Revólver', dano: '2d6', somaVigor: false, alcanceMetros: 20, nota: 'robusto: ignora engasgo no 1 natural' },
  { nome: 'Espingarda', dano: '2d8', somaVigor: false, alcanceMetros: 10, nota: 'a até 3 m: +2 no dano' },
  { nome: 'Fuzil', dano: '2d8', somaVigor: false, alcanceMetros: 60, nota: 'ilegal, escandaloso' },
];

export interface DefinicaoProtecao {
  nome: string;
  defesa: number;
  nota: string;
}

export const PROTECOES: DefinicaoProtecao[] = [
  { nome: 'Colete discreto (R$ 2.500)', defesa: 1, nota: 'passa despercebido' },
  { nome: 'Colete tático', defesa: 2, nota: 'grita "problema"' },
];
