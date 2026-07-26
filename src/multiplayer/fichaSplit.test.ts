import { describe, expect, it } from 'vitest';
import { criarFichaVazia } from '../state/factories';
import { dividirFicha, montarFicha } from './fichaSplit';

describe('dividirFicha / montarFicha', () => {
  it('publico traz só id, nome, corVisual; privado traz o resto', () => {
    const ficha = { ...criarFichaVazia(), nome: 'Maria', pvAtual: 15, atributos: { ...criarFichaVazia().atributos, vigor: 2 } };
    const { publico, privado } = dividirFicha(ficha);

    expect(publico).toEqual({
      id: ficha.id,
      nome: 'Maria',
      corVisual: ficha.corVisual,
    });
    expect(privado).not.toHaveProperty('nome');
    expect(privado.observacaoCombate).toBe('');
    expect(privado.dinheiroReal).toBe(ficha.dinheiroReal);
    expect(privado.sanidadeAtual).toBe(ficha.sanidadeAtual);
    expect(privado.pvAtual).toBe(ficha.pvAtual);
  });

  it('montarFicha reconstrói exatamente a ficha original', () => {
    const original = { ...criarFichaVazia(), nome: 'Pedro', anotacoes: 'segredo' };
    const { publico, privado } = dividirFicha(original);
    const reconstruida = montarFicha(publico, privado);

    expect(reconstruida).toEqual(original);
  });
});
