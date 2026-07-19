import { describe, expect, it } from 'vitest';
import { calcularPerdaSanidade } from './sanidade';

describe('calcularPerdaSanidade', () => {
  it('falha: perde o valor rolado inteiro', () => {
    expect(calcularPerdaSanidade(6, false)).toBe(6);
  });

  it('sucesso: perde metade, arredondada pra baixo', () => {
    expect(calcularPerdaSanidade(6, true)).toBe(3);
    expect(calcularPerdaSanidade(7, true)).toBe(3);
  });

  it('sucesso com rolagem de 1 perde 0', () => {
    expect(calcularPerdaSanidade(1, true)).toBe(0);
  });
});
