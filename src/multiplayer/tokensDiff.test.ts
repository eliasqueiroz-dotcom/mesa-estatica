import { describe, expect, it } from 'vitest';
import type { TokenMapa } from '../state/types';
import { computarDiffTokens } from './tokensDiff';

const token = (over: Partial<TokenMapa> = {}): TokenMapa => ({
  id: 'a',
  participanteId: 'p1',
  tipo: 'pc',
  x: 0.5,
  y: 0.5,
  ...over,
});

describe('computarDiffTokens', () => {
  it('sem mudança nenhuma: upserts e removidos vazios', () => {
    const lista = [token()];
    expect(computarDiffTokens(lista, lista)).toEqual({ upserts: [], removidos: [] });
  });

  it('token novo entra em upserts', () => {
    const diff = computarDiffTokens([], [token()]);
    expect(diff.upserts).toEqual([token()]);
    expect(diff.removidos).toEqual([]);
  });

  it('token com posição alterada entra em upserts', () => {
    const anteriores = [token({ x: 0.5, y: 0.5 })];
    const atuais = [token({ x: 0.7, y: 0.2 })];
    const diff = computarDiffTokens(anteriores, atuais);
    expect(diff.upserts).toEqual(atuais);
  });

  it('token removido entra em removidos, não em upserts', () => {
    const anteriores = [token({ id: 'a' }), token({ id: 'b' })];
    const atuais = [token({ id: 'a' })];
    const diff = computarDiffTokens(anteriores, atuais);
    expect(diff.upserts).toEqual([]);
    expect(diff.removidos).toEqual(['b']);
  });

  it('token idêntico não entra em upserts', () => {
    const anteriores = [token()];
    const atuais = [token()];
    expect(computarDiffTokens(anteriores, atuais).upserts).toEqual([]);
  });

  it('mudança de tipo ou dono também conta como upsert', () => {
    const anteriores = [token({ tipo: 'pc', participanteId: 'p1' })];
    const atuais = [token({ tipo: 'npc', participanteId: 'p1' })];
    expect(computarDiffTokens(anteriores, atuais).upserts).toEqual(atuais);
  });
});
