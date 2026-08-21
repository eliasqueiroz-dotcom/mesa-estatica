import { describe, expect, it } from 'vitest';
import type { TokenMapa } from '../state/types';
import { resolverReplayToken } from './tokensSync';

const token = (id: string): TokenMapa => ({ id, participanteId: `p-${id}`, tipo: 'pc', x: 0, y: 0 });

describe('resolverReplayToken', () => {
  it('chave normal (id de token) que ainda existe localmente devolve o token pra reenviar', () => {
    const tokens = [token('a'), token('b')];
    expect(resolverReplayToken('a', tokens)).toEqual(token('a'));
  });

  it('chave normal que não existe mais localmente devolve null (nada a fazer)', () => {
    expect(resolverReplayToken('sumiu', [token('a')])).toBeNull();
  });

  it('chave "delete:<id>" sempre devolve \'apagar\', mesmo se o id nunca existiu localmente', () => {
    expect(resolverReplayToken('delete:x', [token('a')])).toBe('apagar');
    expect(resolverReplayToken('delete:x', [])).toBe('apagar');
  });

  it('lista vazia de tokens não quebra a resolução', () => {
    expect(resolverReplayToken('a', [])).toBeNull();
  });
});
