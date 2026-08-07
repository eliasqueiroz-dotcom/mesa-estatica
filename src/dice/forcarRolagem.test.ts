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

describe('casamento por tipo de rolagem', () => {
  it('entrada de um tipo não é consumida por rolagem de outro — o bug que travou ligar a fila em tudo', () => {
    enfileirarForcado([20], 'pc-1', 'A', 'teste');
    // a iniciativa do MESMO personagem role antes: não pode roubar o valor guardado pro teste
    expect(consumirForcados(1, 'pc-1', 'iniciativa')).toBeNull();
    // e o valor continua lá, esperando o teste
    expect(consumirForcados(1, 'pc-1', 'teste')).toEqual([20]);
  });

  it('entrada "qualquer" casa com toda rolagem', () => {
    enfileirarForcado([7], 'pc-1', 'A', 'qualquer');
    expect(consumirForcados(1, 'pc-1', 'iniciativa')).toEqual([7]);
  });

  it('rolagem "qualquer" (rolagem livre) casa com entrada de qualquer tipo', () => {
    enfileirarForcado([9], 'pc-1', 'A', 'dano');
    expect(consumirForcados(1, 'pc-1', 'qualquer')).toEqual([9]);
  });

  it('pula a entrada de tipo errado e consome a certa, mesmo estando depois na fila', () => {
    enfileirarForcado([1], null, 'qualquer', 'sanidade');
    enfileirarForcado([18], null, 'qualquer', 'iniciativa');
    expect(consumirForcados(1, null, 'iniciativa')).toEqual([18]);
    // a de sanidade ficou intacta
    expect(filaAtual()).toHaveLength(1);
    expect(filaAtual()[0].tipo).toBe('sanidade');
  });

  it('exige os dois eixos: tipo certo mas personagem errado não casa', () => {
    enfileirarForcado([20], 'pc-1', 'A', 'iniciativa');
    expect(consumirForcados(1, 'pc-2', 'iniciativa')).toBeNull();
  });

  it('sem tipo explícito, a entrada entra como "qualquer" (compatível com o comportamento antigo)', () => {
    enfileirarForcado([12], null, 'qualquer');
    expect(filaAtual()[0].tipo).toBe('qualquer');
    expect(consumirForcados(1, 'pc-9', 'surto')).toEqual([12]);
  });
});
