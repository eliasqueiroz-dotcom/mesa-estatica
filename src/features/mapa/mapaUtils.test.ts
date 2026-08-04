import { describe, expect, it } from 'vitest';
import type { GradeMapa } from '../../state/types';
import { centroDaCelula, distanciaEmCelulas, distanciaTotal, emDeslocamentos, formatarDistancia, type Ponto } from './mapaUtils';

const pontoProximo = (recebido: Ponto, esperado: Ponto) => {
  expect(recebido.x).toBeCloseTo(esperado.x);
  expect(recebido.y).toBeCloseTo(esperado.y);
};

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

describe('centroDaCelula', () => {
  it('faz snap ao centro da célula (0-indexed) com grid ativo', () => {
    const grade = gradeQuadrada();
    pontoProximo(centroDaCelula(0.03, 0.07, grade), { x: 0.05, y: 0.05 });
  });

  it('mantém o mesmo centro pra qualquer ponto dentro da mesma célula (roundtrip estável)', () => {
    const grade = gradeQuadrada();
    const a = centroDaCelula(0.11, 0.19, grade);
    const b = centroDaCelula(0.15, 0.15, grade);
    pontoProximo(a, b);
    pontoProximo(a, { x: 0.15, y: 0.15 });
  });

  it('extrapola além da borda desenhada do grid usando o mesmo tamanho de célula', () => {
    const grade = gradeQuadrada({ x: 20, y: 20, largura: 60, altura: 60, colunas: 6, linhas: 6 });
    // célula normalizada: largura/colunas = 0.6/6 = 0.1; grid começa em x=0.2 — um ponto antes
    // do início (x=0.03) ainda faz snap, usando a mesma grade de células continuada pra fora.
    pontoProximo(centroDaCelula(0.03, 0.03, grade), { x: 0.05, y: 0.05 });
  });

  it('sem grid ativo, devolve a posição crua (medição livre, sem trava)', () => {
    const grade = gradeQuadrada({ ativa: false });
    expect(centroDaCelula(0.234, 0.567, grade)).toEqual({ x: 0.234, y: 0.567 });
  });
});

describe('distanciaEmCelulas', () => {
  it('1 célula na horizontal = 1 célula de distância', () => {
    const grade = gradeQuadrada();
    expect(distanciaEmCelulas({ x: 0.05, y: 0.05 }, { x: 0.15, y: 0.05 }, grade)).toBeCloseTo(1);
  });

  it('diagonal é euclidiana — 1 célula na diagonal = √2 células', () => {
    const grade = gradeQuadrada();
    expect(distanciaEmCelulas({ x: 0.05, y: 0.05 }, { x: 0.15, y: 0.15 }, grade)).toBeCloseTo(Math.SQRT2);
  });

  it('continua medindo em células mesmo com o grid desligado (ativa: false)', () => {
    const grade = gradeQuadrada({ ativa: false });
    expect(distanciaEmCelulas({ x: 0.05, y: 0.05 }, { x: 0.15, y: 0.05 }, grade)).toBeCloseTo(1);
  });

  it('célula não quadrada: 1 célula horizontal e 1 vertical contam igual, mesmo com proporção diferente', () => {
    // largura/colunas = 100/10 = 10% por célula; altura/linhas = 100/20 = 5% por célula
    const grade = gradeQuadrada({ linhas: 20 });
    const horizontal = distanciaEmCelulas({ x: 0, y: 0 }, { x: 0.1, y: 0 }, grade);
    const vertical = distanciaEmCelulas({ x: 0, y: 0 }, { x: 0, y: 0.05 }, grade);
    expect(horizontal).toBeCloseTo(1);
    expect(vertical).toBeCloseTo(1);
  });

  it('geometria inválida (largura/colunas zerados) devolve 0 em vez de NaN/Infinity', () => {
    const grade = gradeQuadrada({ colunas: 0 });
    expect(distanciaEmCelulas({ x: 0, y: 0 }, { x: 1, y: 1 }, grade)).toBe(0);
  });
});

describe('distanciaTotal', () => {
  it('soma os segmentos de uma polilinha com waypoints (desvio de obstáculo)', () => {
    const grade = gradeQuadrada();
    const pontos = [
      { x: 0.05, y: 0.05 },
      { x: 0.15, y: 0.05 }, // waypoint — desvia de um obstáculo
      { x: 0.15, y: 0.15 },
    ];
    // 2 células (1 + 1) * escala 1.5
    expect(distanciaTotal(pontos, grade)).toBeCloseTo(3);
  });

  it('escala 5 unidades/célula', () => {
    const grade = gradeQuadrada({ escala: 5 });
    const pontos = [{ x: 0.05, y: 0.05 }, { x: 0.15, y: 0.05 }];
    expect(distanciaTotal(pontos, grade)).toBeCloseTo(5);
  });

  it('escala 0.5 unidades/célula', () => {
    const grade = gradeQuadrada({ escala: 0.5 });
    const pontos = [{ x: 0.05, y: 0.05 }, { x: 0.15, y: 0.05 }];
    expect(distanciaTotal(pontos, grade)).toBeCloseTo(0.5);
  });

  it('um único ponto (ainda não arrastou) mede zero', () => {
    const grade = gradeQuadrada();
    expect(distanciaTotal([{ x: 0.05, y: 0.05 }], grade)).toBe(0);
  });
});

describe('formatarDistancia', () => {
  it('metros com vírgula decimal', () => {
    expect(formatarDistancia(1.5, 'm')).toBe('1,5 m');
  });

  it('metros inteiros sem casa decimal', () => {
    expect(formatarDistancia(13, 'm')).toBe('13 m');
  });

  it('quilômetros com vírgula decimal', () => {
    expect(formatarDistancia(1.2, 'km')).toBe('1,2 km');
  });

  it('quilômetro abaixo de 1 vira metros (mais legível)', () => {
    expect(formatarDistancia(0.75, 'km')).toBe('750 m');
  });
});

describe('emDeslocamentos', () => {
  it('9 m = 1 deslocamento', () => {
    expect(emDeslocamentos(9)).toBe('1 deslocamento');
  });

  it('13.5 m = 1,5 deslocamentos (precisão de meio deslocamento)', () => {
    expect(emDeslocamentos(13.5)).toBe('1,5 deslocamentos');
  });

  it('0 m = 0 deslocamentos', () => {
    expect(emDeslocamentos(0)).toBe('0 deslocamentos');
  });
});
