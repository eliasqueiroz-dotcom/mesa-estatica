import { describe, expect, it } from 'vitest';
import { ehRolagemPropria, marcarComoProprio } from './rolagemAoVivoStore';

describe('marcarComoProprio / ehRolagemPropria', () => {
  it('um id marcado como próprio é reconhecido como próprio', () => {
    const id = 'rolagem-teste-1';
    expect(ehRolagemPropria(id)).toBe(false);
    marcarComoProprio(id);
    expect(ehRolagemPropria(id)).toBe(true);
  });

  it('um id nunca marcado não é considerado próprio (rolagem de outro jogador)', () => {
    expect(ehRolagemPropria('rolagem-nunca-marcada')).toBe(false);
  });

  it('marcar não afeta outros ids', () => {
    marcarComoProprio('rolagem-teste-2');
    expect(ehRolagemPropria('rolagem-teste-3')).toBe(false);
  });
});
