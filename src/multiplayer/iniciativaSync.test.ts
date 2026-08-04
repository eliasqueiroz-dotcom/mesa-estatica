import { describe, expect, it } from 'vitest';
import type { EntradaIniciativa } from '../state/types';
import { paraEntrada, paraLinha } from './iniciativaSync';

describe('paraLinha / paraEntrada', () => {
  it('round-trip preserva os campos da entrada de iniciativa', () => {
    const entrada: EntradaIniciativa = { id: 'e1', participanteId: 'pc-1', tipo: 'pc', nome: 'Helena', valor: 17 };
    const linha = paraLinha(entrada, 2);
    expect(linha).toEqual({ id: 'e1', participante_id: 'pc-1', tipo: 'pc', nome: 'Helena', valor: 17, posicao: 2 });

    const reconstruida = paraEntrada(linha);
    expect(reconstruida).toEqual(entrada);
  });

  it('preserva o tipo npc', () => {
    const entrada: EntradaIniciativa = { id: 'e2', participanteId: 'npc-1', tipo: 'npc', nome: 'Guarda', valor: 9 };
    const linha = paraLinha(entrada, 0);
    expect(paraEntrada(linha).tipo).toBe('npc');
  });
});
