import { describe, expect, it } from 'vitest';
import { calcularPosicaoEsperada, precisaResincronizar } from './posicaoMidia';

describe('calcularPosicaoEsperada', () => {
  it('parada: devolve a posição salva, sem projetar tempo', () => {
    const agora = Date.now();
    const estado = { tocando: false, posicaoSegundos: 42, atualizadoEm: new Date(agora - 10_000).toISOString() };
    expect(calcularPosicaoEsperada(estado, agora)).toBe(42);
  });

  it('tocando: soma o tempo decorrido desde atualizadoEm', () => {
    const agora = Date.now();
    const estado = { tocando: true, posicaoSegundos: 10, atualizadoEm: new Date(agora - 5_000).toISOString() };
    expect(calcularPosicaoEsperada(estado, agora)).toBeCloseTo(15, 1);
  });

  it('nunca projeta tempo negativo (relógio adiantado no cliente)', () => {
    const agora = Date.now();
    const estado = { tocando: true, posicaoSegundos: 10, atualizadoEm: new Date(agora + 5_000).toISOString() };
    expect(calcularPosicaoEsperada(estado, agora)).toBe(10);
  });
});

describe('precisaResincronizar', () => {
  it('desvio dentro do limiar: não resincroniza', () => {
    expect(precisaResincronizar(10, 11)).toBe(false);
  });

  it('desvio acima do limiar: resincroniza', () => {
    expect(precisaResincronizar(10, 12)).toBe(true);
    expect(precisaResincronizar(12, 10)).toBe(true);
  });
});
