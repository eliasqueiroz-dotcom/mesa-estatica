import { describe, expect, it } from 'vitest';
import { instalarHandlerGlobalDeErro, mensagemDoErro } from './globalErrorHandler';

describe('mensagemDoErro', () => {
  it('extrai .message de um Error de verdade', () => {
    expect(mensagemDoErro(new Error('deu ruim'))).toBe('deu ruim');
  });

  it('devolve a própria string quando o motivo já é string', () => {
    expect(mensagemDoErro('motivo cru')).toBe('motivo cru');
  });

  it('converte outros tipos via String()', () => {
    expect(mensagemDoErro(42)).toBe('42');
    expect(mensagemDoErro(undefined)).toBe('undefined');
  });
});

describe('instalarHandlerGlobalDeErro', () => {
  // ambiente de teste roda em Node puro (sem jsdom) — o guard `typeof window === 'undefined'`
  // é o que garante que isso não é um no-op silencioso quebrado em produção, é a saída
  // deliberada documentada em store.ts pro mesmo padrão (criarStorageComDebounce).
  it('não lança quando não há `window` (ambiente de teste)', () => {
    expect(() => instalarHandlerGlobalDeErro()).not.toThrow();
  });
});
