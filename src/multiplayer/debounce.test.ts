import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarDebouncePorChave, criarThrottlePorChave } from './debounce';

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

describe('criarThrottlePorChave', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('primeira chamada de uma chave fria executa na hora, sem esperar o intervalo', () => {
    const executar = vi.fn();
    const agendar = criarThrottlePorChave<number>(100, executar);

    agendar('a', 1);

    expect(executar).toHaveBeenCalledTimes(1);
    expect(executar).toHaveBeenCalledWith('a', 1);
  });

  it('chamadas dentro do intervalo só disparam a mais recente no próximo tick', () => {
    const executar = vi.fn();
    const agendar = criarThrottlePorChave<number>(100, executar);

    agendar('a', 1); // dispara na hora (chave fria)
    vi.advanceTimersByTime(50);
    agendar('a', 2); // fica pendente
    agendar('a', 3); // sobrescreve o pendente
    vi.advanceTimersByTime(50); // completa os 100ms — tick dispara o valor pendente mais recente

    expect(executar).toHaveBeenCalledTimes(2);
    expect(executar).toHaveBeenNthCalledWith(1, 'a', 1);
    expect(executar).toHaveBeenNthCalledWith(2, 'a', 3);
  });

  it('sem chamada nenhuma dentro de um tick, a chave volta a ficar fria (próxima chamada executa na hora de novo)', () => {
    const executar = vi.fn();
    const agendar = criarThrottlePorChave<number>(100, executar);

    agendar('a', 1);
    vi.advanceTimersByTime(100); // tick roda sem pendente — chave volta a ficar fria
    agendar('a', 2);

    expect(executar).toHaveBeenCalledTimes(2);
    expect(executar).toHaveBeenNthCalledWith(2, 'a', 2);
  });

  it('arrasto contínuo dispara em cada intervalo, e a posição de soltura final sempre é enviada', () => {
    const executar = vi.fn();
    const agendar = criarThrottlePorChave<number>(100, executar);

    agendar('token-1', 0); // t=0, dispara na hora
    for (let t = 10; t <= 240; t += 10) {
      vi.advanceTimersByTime(10);
      agendar('token-1', t); // simula pointermove contínuo
    }
    // solta o token logo depois do último pointermove, sem mais nenhuma chamada
    vi.advanceTimersByTime(100);

    expect(executar.mock.calls.length).toBeGreaterThan(1); // viu passos intermediários, não só o final
    expect(executar).toHaveBeenLastCalledWith('token-1', 240); // última posição sempre chega
  });

  it('chaves diferentes têm cooldowns independentes', () => {
    const executar = vi.fn();
    const agendar = criarThrottlePorChave<string>(100, executar);

    agendar('token-1', 'x'); // dispara na hora
    agendar('token-2', 'y'); // dispara na hora — chave diferente, sem relação com o cooldown de token-1

    expect(executar).toHaveBeenCalledTimes(2);
    expect(executar).toHaveBeenCalledWith('token-1', 'x');
    expect(executar).toHaveBeenCalledWith('token-2', 'y');
  });
});
