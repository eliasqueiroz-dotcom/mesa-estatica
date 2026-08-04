import { describe, expect, it } from 'vitest';
import { efeitoCondicao, nomeCondicao } from './condicoesCombate';

describe('efeitoCondicao', () => {
  it('retorna o efeito de uma condição conhecida', () => {
    expect(efeitoCondicao('exposto')).toBe('-2 na Defesa.');
  });

  it('retorna string vazia pra id desconhecido', () => {
    expect(efeitoCondicao('inexistente')).toBe('');
  });
});

describe('nomeCondicao', () => {
  it('retorna o próprio id quando desconhecido (fallback)', () => {
    expect(nomeCondicao('inexistente')).toBe('inexistente');
  });
});
