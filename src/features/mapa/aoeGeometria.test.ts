import { describe, expect, it } from 'vitest';
import type { GradeMapa } from '../../state/types';
import { pontoDentroTemplate, tamanhoTemplateEmCelulas, type TemplateAoE } from './aoeGeometria';

const gradeQuadrada = (overrides: Partial<GradeMapa> = {}): GradeMapa => ({
  ativa: true,
  x: 0,
  y: 0,
  largura: 100,
  altura: 100,
  colunas: 10,
  linhas: 10,
  escala: 1.5,
  unidade: 'm',
  ...overrides,
});

describe('tamanhoTemplateEmCelulas', () => {
  it('círculo: raio euclidiano em células', () => {
    const grade = gradeQuadrada();
    // célula = 0.1 normalizado; origem em (0.5,0.5), alvo 3 células pra direita
    const t: TemplateAoE = { forma: 'circulo', origem: { x: 0.5, y: 0.5 }, alvo: { x: 0.8, y: 0.5 } };
    expect(tamanhoTemplateEmCelulas(t, grade)).toBeCloseTo(3);
  });

  it('quadrado: metade do lado, distância de Chebyshev', () => {
    const grade = gradeQuadrada();
    const t: TemplateAoE = { forma: 'quadrado', origem: { x: 0.5, y: 0.5 }, alvo: { x: 0.7, y: 0.55 } };
    // dCol=2 células, dRow=0.5 célula → Chebyshev = 2
    expect(tamanhoTemplateEmCelulas(t, grade)).toBeCloseTo(2);
  });
});

describe('pontoDentroTemplate — círculo', () => {
  const grade = gradeQuadrada();
  const t: TemplateAoE = { forma: 'circulo', origem: { x: 0.5, y: 0.5 }, alvo: { x: 0.8, y: 0.5 } }; // raio 3 células

  it('ponto no centro está dentro', () => {
    expect(pontoDentroTemplate({ x: 0.5, y: 0.5 }, t, grade)).toBe(true);
  });

  it('ponto na borda (exatamente no raio) está dentro', () => {
    expect(pontoDentroTemplate({ x: 0.8, y: 0.5 }, t, grade)).toBe(true);
  });

  it('ponto além do raio fica de fora', () => {
    expect(pontoDentroTemplate({ x: 0.9, y: 0.5 }, t, grade)).toBe(false);
  });

  it('ponto na diagonal, dentro do raio euclidiano', () => {
    // 2 células em col e row → hypot ≈ 2.83, dentro do raio 3
    expect(pontoDentroTemplate({ x: 0.7, y: 0.7 }, t, grade)).toBe(true);
  });
});

describe('pontoDentroTemplate — quadrado', () => {
  const grade = gradeQuadrada();
  const t: TemplateAoE = { forma: 'quadrado', origem: { x: 0.5, y: 0.5 }, alvo: { x: 0.7, y: 0.5 } }; // metade do lado = 2 células

  it('ponto no centro está dentro', () => {
    expect(pontoDentroTemplate({ x: 0.5, y: 0.5 }, t, grade)).toBe(true);
  });

  it('ponto na diagonal do quadrado (dentro do lado nos dois eixos) está dentro', () => {
    // 2 células em col E row — quadrado usa Chebyshev, não teria ficado dentro de um círculo de raio 2
    expect(pontoDentroTemplate({ x: 0.7, y: 0.7 }, t, grade)).toBe(true);
  });

  it('ponto fora do lado em um eixo fica de fora', () => {
    expect(pontoDentroTemplate({ x: 0.9, y: 0.5 }, t, grade)).toBe(false);
  });
});
