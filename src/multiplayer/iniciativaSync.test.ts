import { describe, expect, it } from 'vitest';
import type { EntradaIniciativa } from '../state/types';
import { paraEntrada, paraLinha } from './iniciativaSync';

describe('paraLinha / paraEntrada', () => {
  it('round-trip preserva os campos da entrada de iniciativa', () => {
    const entrada: EntradaIniciativa = { id: 'e1', participanteId: 'pc-1', tipo: 'pc', nome: 'Helena', valor: 17 };
    const linha = paraLinha(entrada, 2);
    expect(linha).toEqual({
      id: 'e1', participante_id: 'pc-1', tipo: 'pc', nome: 'Helena', valor: 17, posicao: 2,
      d20: null, agilidade: null,
    });

    const reconstruida = paraEntrada(linha);
    expect(reconstruida).toEqual(entrada);
  });

  it('preserva o tipo npc', () => {
    const entrada: EntradaIniciativa = { id: 'e2', participanteId: 'npc-1', tipo: 'npc', nome: 'Guarda', valor: 9 };
    const linha = paraLinha(entrada, 0);
    expect(paraEntrada(linha).tipo).toBe('npc');
  });

  it('round-trip preserva d20/agilidade — sem isso o tooltip "rolagem iniciativa" perde o detalhe depois de sincronizar', () => {
    const entrada: EntradaIniciativa = { id: 'e3', participanteId: 'pc-2', tipo: 'pc', nome: 'Marco', valor: 15, d20: 12, agilidade: 3 };
    const linha = paraLinha(entrada, 1);
    expect(linha.d20).toBe(12);
    expect(linha.agilidade).toBe(3);

    const reconstruida = paraEntrada(linha);
    expect(reconstruida).toEqual(entrada);
  });

  it('linha sem d20/agilidade (dado salvo antes da migração 0033) reconstrói sem esses campos, não como null', () => {
    const linhaAntiga = { id: 'e4', participante_id: 'pc-3', tipo: 'pc' as const, nome: 'Ana', valor: 14, posicao: 0, d20: null, agilidade: null };
    const entrada = paraEntrada(linhaAntiga);
    expect(entrada.d20).toBeUndefined();
    expect(entrada.agilidade).toBeUndefined();
  });
});
