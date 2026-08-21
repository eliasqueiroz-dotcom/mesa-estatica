import { describe, expect, it } from 'vitest';
import { CONDICOES_COMBATE, abreviacaoCondicao, badgeCondicoes, efeitoCondicao, nomeCondicao } from './condicoesCombate';

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

describe('abreviacaoCondicao', () => {
  it('todas as 8 condições têm abreviação única de 3 letras', () => {
    const abreviacoes = CONDICOES_COMBATE.map((c) => c.abreviacao);
    expect(abreviacoes.every((a) => a.length === 3 && a === a.toUpperCase())).toBe(true);
    expect(new Set(abreviacoes).size).toBe(abreviacoes.length);
  });

  it('fallback pra id desconhecido: 3 primeiras letras em maiúsculo', () => {
    expect(abreviacaoCondicao('inexistente')).toBe('INE');
  });
});

describe('badgeCondicoes', () => {
  it('array vazio -> string vazia (sem badge)', () => {
    expect(badgeCondicoes([])).toBe('');
  });

  it('1 condição -> só a abreviação, sem sufixo', () => {
    expect(badgeCondicoes(['exposto'])).toBe('EXP');
  });

  it('múltiplas condições -> abreviação da primeira + quantas sobram', () => {
    expect(badgeCondicoes(['caido', 'mirando', 'aguardando'])).toBe('CAI+2');
  });
});
