import { describe, expect, it } from 'vitest';
import type { FaixaMidia } from '../state/types';
import { computarDiffFaixas } from './midiaFaixasDiff';

const faixa = (over: Partial<FaixaMidia> = {}): FaixaMidia => ({
  id: 'a',
  nome: 'faixa 1',
  path: 'abc-faixa1.mp3',
  url: 'https://exemplo.test/midia/abc-faixa1.mp3',
  ordem: 0,
  criadoEm: '2026-07-24T00:00:00.000Z',
  ...over,
});

describe('computarDiffFaixas', () => {
  it('sem mudança nenhuma: upserts e removidos vazios', () => {
    const lista = [faixa()];
    expect(computarDiffFaixas(lista, lista)).toEqual({ upserts: [], removidos: [] });
  });

  it('faixa nova entra em upserts', () => {
    const diff = computarDiffFaixas([], [faixa()]);
    expect(diff.upserts).toEqual([faixa()]);
    expect(diff.removidos).toEqual([]);
  });

  it('mudança de ordem (reordenar) entra em upserts', () => {
    const anteriores = [faixa({ ordem: 0 })];
    const atuais = [faixa({ ordem: 1 })];
    expect(computarDiffFaixas(anteriores, atuais).upserts).toEqual(atuais);
  });

  it('faixa removida entra em removidos, não em upserts', () => {
    const anteriores = [faixa({ id: 'a' }), faixa({ id: 'b' })];
    const atuais = [faixa({ id: 'a' })];
    const diff = computarDiffFaixas(anteriores, atuais);
    expect(diff.upserts).toEqual([]);
    expect(diff.removidos).toEqual(['b']);
  });

  it('faixa idêntica não entra em upserts', () => {
    const anteriores = [faixa()];
    const atuais = [faixa()];
    expect(computarDiffFaixas(anteriores, atuais).upserts).toEqual([]);
  });

  it('mudança de nome também conta como upsert', () => {
    const anteriores = [faixa({ nome: 'antiga' })];
    const atuais = [faixa({ nome: 'nova' })];
    expect(computarDiffFaixas(anteriores, atuais).upserts).toEqual(atuais);
  });

  it('mudança só de tag também conta como upsert', () => {
    const anteriores = [faixa({ tag: undefined })];
    const atuais = [faixa({ tag: 'tensão' })];
    expect(computarDiffFaixas(anteriores, atuais).upserts).toEqual(atuais);
  });
});
