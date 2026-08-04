import { describe, expect, it } from 'vitest';
import { eraRemocaoExplicita, marcarRemocaoExplicita } from './remocaoExplicita';

describe('marcarRemocaoExplicita / eraRemocaoExplicita', () => {
  it('id nunca marcado não é remoção explícita', () => {
    expect(eraRemocaoExplicita('nunca-marcado')).toBe(false);
  });

  it('id marcado é remoção explícita — uma vez só', () => {
    marcarRemocaoExplicita('f1');
    expect(eraRemocaoExplicita('f1')).toBe(true);
    // consome a marca — perguntar de novo pelo mesmo id não deve continuar dizendo "sim"
    // (evita apagar de novo por engano num segundo diff que reveja o mesmo id "sumido")
    expect(eraRemocaoExplicita('f1')).toBe(false);
  });

  it('marcar não afeta outros ids', () => {
    marcarRemocaoExplicita('f2');
    expect(eraRemocaoExplicita('f3')).toBe(false);
    expect(eraRemocaoExplicita('f2')).toBe(true);
  });
});
