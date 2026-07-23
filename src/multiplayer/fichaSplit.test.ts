import { describe, expect, it } from 'vitest';
import { criarFichaVazia } from '../state/factories';
import { dividirFicha, montarFicha } from './fichaSplit';

describe('dividirFicha / montarFicha', () => {
  it('publico traz só o que a mesa vê; privado traz o resto', () => {
    const ficha = { ...criarFichaVazia(), nome: 'Maria', pvAtual: 15, atributos: { ...criarFichaVazia().atributos, vigor: 2 } };
    const { publico, privado } = dividirFicha(ficha, 20);

    expect(publico).toEqual({
      id: ficha.id,
      nome: 'Maria',
      corVisual: ficha.corVisual,
      pvAtual: 15,
      pvMaximo: 30, // 20 + 5*2
      surtosAtivos: ficha.surtosAtivos,
    });
    expect(privado).not.toHaveProperty('nome');
    expect(privado).not.toHaveProperty('pvAtual');
    expect(privado.dinheiroReal).toBe(ficha.dinheiroReal);
    expect(privado.sanidadeAtual).toBe(ficha.sanidadeAtual);
  });

  it('montarFicha reconstrói exatamente a ficha original (menos o pvMaximo derivado)', () => {
    const original = { ...criarFichaVazia(), nome: 'Pedro', anotacoes: 'segredo' };
    const { publico, privado } = dividirFicha(original, 20);
    const reconstruida = montarFicha(publico, privado);

    expect(reconstruida).toEqual(original);
  });

  it('pvMaximo não vaza pra dentro da ficha reconstruída', () => {
    const original = criarFichaVazia();
    const { publico, privado } = dividirFicha(original, 20);
    const reconstruida = montarFicha(publico, privado);

    expect(reconstruida).not.toHaveProperty('pvMaximo');
  });
});
