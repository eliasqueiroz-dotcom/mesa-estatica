import { describe, expect, it, beforeEach } from 'vitest';
import {
  enfileirarForcado,
  removerForcado,
  limparForcados,
  filaAtual,
  consumirForcados,
} from './forcarRolagem';

beforeEach(() => {
  // limpa a fila antes de cada teste
  limparForcados();
});

describe('fila', () => {
  it('enfileirarForcado adiciona entrada', () => {
    enfileirarForcado([10], 'pc-1', 'Personagem');
    expect(filaAtual().length).toBe(1);
    expect(filaAtual()[0].personagemId).toBe('pc-1');
    expect(filaAtual()[0].valores).toEqual([10]);
  });

  it('removerForcado remove por id', () => {
    enfileirarForcado([10], null, 'qualquer');
    const entrada = filaAtual()[0];
    removerForcado(entrada.id);
    expect(filaAtual().length).toBe(0);
  });

  it('limparForcados esvazia fila', () => {
    enfileirarForcado([10], 'pc-1', 'A');
    enfileirarForcado([15], 'pc-2', 'B');
    limparForcados();
    expect(filaAtual().length).toBe(0);
  });

  it('consumirForcados retorna null quando fila vazia', () => {
    const r = consumirForcados(1, 'pc-1');
    expect(r).toBeNull();
  });

  it('consumirForcados casa com personagem específico', () => {
    enfileirarForcado([10], 'pc-1', 'A');
    enfileirarForcado([15], 'pc-2', 'B');
    const resultado = consumirForcados(1, 'pc-1');
    expect(resultado).toEqual([10]);
    expect(filaAtual().length).toBe(1);
    expect(filaAtual()[0].personagemId).toBe('pc-2');
  });

  it('consumirForcados casa com "qualquer"', () => {
    enfileirarForcado([20], null, 'qualquer');
    const r = consumirForcados(3, 'pc-1');
    expect(r).toEqual([20, 20, 20]);
  });

  it('merge de estado não duplica entradas de mesmo id', () => {
    enfileirarForcado([10], null, 'A');
    const original = filaAtual()[0];
    expect(filaAtual().filter((e) => e.id === original.id).length).toBe(1);
  });
});
