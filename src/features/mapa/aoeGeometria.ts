import type { GradeMapa } from '../../state/types';
import { tamanhoCelula, type Ponto } from './mapaUtils';

/** Círculo e Quadrado só — Cone e Linha exigem matemática de ângulo/segmento que não coube
 *  neste corte (escopo reduzido de propósito). */
export type FormaAoE = 'circulo' | 'quadrado';

export interface TemplateAoE {
  forma: FormaAoE;
  /** 0-1 normalizado à IMAGEM — mesma base de TokenMapa/GradeMapa, mesma convenção da régua. */
  origem: Ponto;
  alvo: Ponto;
}

interface PontoCelula {
  col: number;
  row: number;
}

function paraCelulas(p: Ponto, grade: GradeMapa): PontoCelula | null {
  const celula = tamanhoCelula(grade);
  if (!celula) return null;
  return { col: p.x / celula.larguraCelula, row: p.y / celula.alturaCelula };
}

/** Tamanho do template em células — raio pro círculo (distância euclidiana), metade do lado
 *  pro quadrado (distância de Chebyshev, coerente com "arrastar até um canto"). */
export function tamanhoTemplateEmCelulas(t: TemplateAoE, grade: GradeMapa): number {
  const o = paraCelulas(t.origem, grade);
  const a = paraCelulas(t.alvo, grade);
  if (!o || !a) return 0;
  const dCol = a.col - o.col;
  const dRow = a.row - o.row;
  return t.forma === 'quadrado' ? Math.max(Math.abs(dCol), Math.abs(dRow)) : Math.hypot(dCol, dRow);
}

/** true se o ponto (centro de um token, normalizado à imagem) cai dentro do template. */
export function pontoDentroTemplate(p: Ponto, t: TemplateAoE, grade: GradeMapa): boolean {
  const o = paraCelulas(t.origem, grade);
  const pc = paraCelulas(p, grade);
  if (!o || !pc) return false;
  const tamanho = tamanhoTemplateEmCelulas(t, grade);
  const dCol = pc.col - o.col;
  const dRow = pc.row - o.row;
  return t.forma === 'quadrado' ? Math.abs(dCol) <= tamanho && Math.abs(dRow) <= tamanho : Math.hypot(dCol, dRow) <= tamanho;
}
