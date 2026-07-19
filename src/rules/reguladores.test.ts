import { describe, expect, it } from 'vitest';
import { estaDependente } from './reguladores';

describe('estaDependente', () => {
  it('dispara com dose na sessão atual e na anterior', () => {
    expect(estaDependente([3, 4], 4)).toBe(true);
  });
  it('não dispara com uma única sessão de dose', () => {
    expect(estaDependente([4], 4)).toBe(false);
  });
  it('não dispara se as sessões não são consecutivas', () => {
    expect(estaDependente([1, 4], 4)).toBe(false);
  });
});
