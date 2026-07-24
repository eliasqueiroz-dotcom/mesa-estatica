import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarDebouncePorChave } from './debounce';

describe('criarDebouncePorChave', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('chamadas repetidas pra mesma chave só executam uma vez, com o valor mais recente', () => {
    const executar = vi.fn();
    const agendar = criarDebouncePorChave<number>(100, executar);

    agendar('a', 1);
    vi.advanceTimersByTime(50);
    agendar('a', 2);
    vi.advanceTimersByTime(50);
    agendar('a', 3);
    vi.advanceTimersByTime(100);

    expect(executar).toHaveBeenCalledTimes(1);
    expect(executar).toHaveBeenCalledWith('a', 3);
  });

  it('chaves diferentes têm timers independentes', () => {
    const executar = vi.fn();
    const agendar = criarDebouncePorChave<string>(100, executar);

    agendar('token-1', 'x');
    vi.advanceTimersByTime(60);
    agendar('token-2', 'y');
    vi.advanceTimersByTime(60);

    expect(executar).toHaveBeenCalledTimes(1);
    expect(executar).toHaveBeenCalledWith('token-1', 'x');

    vi.advanceTimersByTime(60);
    expect(executar).toHaveBeenCalledTimes(2);
    expect(executar).toHaveBeenCalledWith('token-2', 'y');
  });

  it('sem chamada nenhuma, não executa nada', () => {
    const executar = vi.fn();
    criarDebouncePorChave<number>(100, executar);
    vi.advanceTimersByTime(1000);
    expect(executar).not.toHaveBeenCalled();
  });
});
