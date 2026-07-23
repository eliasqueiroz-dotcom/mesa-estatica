import { describe, expect, it } from 'vitest';
import { corPv } from './useIniciativa';

describe('corPv', () => {
  it('≤25% retorna ruido', () => {
    expect(corPv(2, 10)).toBe('var(--ruido)');
    expect(corPv(0, 10)).toBe('var(--ruido)');
  });

  it('≤50% retorna real', () => {
    expect(corPv(3, 10)).toBe('var(--real)');
    expect(corPv(5, 10)).toBe('var(--real)');
  });

  it('>50% retorna rede', () => {
    expect(corPv(6, 10)).toBe('var(--rede)');
    expect(corPv(10, 10)).toBe('var(--rede)');
  });
});

describe('rolarDano', () => {
  it('parser 1d6 retorna 1-6', () => {
    const match = '1d6'.match(/^(\d+)d(\d+)(?:\+(\d+))?$/i);
    expect(match).not.toBeNull();
    const qtd = parseInt(match![1], 10);
    const faces = parseInt(match![2], 10);
    expect(qtd).toBe(1);
    expect(faces).toBe(6);
  });

  it('parser 2d8+3 retorna 5-19', () => {
    const match = '2d8+3'.match(/^(\d+)d(\d+)(?:\+(\d+))?$/i);
    expect(match).not.toBeNull();
    const qtd = parseInt(match![1], 10);
    const faces = parseInt(match![2], 10);
    const mod = parseInt(match![3], 10);
    expect(qtd).toBe(2);
    expect(faces).toBe(8);
    expect(mod).toBe(3);
  });

  it('string inválida retorna 0', () => {
    const match = 'abc'.match(/^(\d+)d(\d+)(?:\+(\d+))?$/i);
    expect(match).toBeNull();
  });
});
