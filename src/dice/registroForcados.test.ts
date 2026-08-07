import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  consumirForcadosRegistrado,
  limparConsumidorForcados,
  registrarConsumidorForcados,
  rolarDadoComForcados,
  rolarDadosComForcados,
} from './registroForcados';

afterEach(() => {
  limparConsumidorForcados();
  vi.restoreAllMocks();
});

describe('registroForcados', () => {
  it('sem ninguém registrado (bundle do jogador) nunca força — é o default que garante honestidade lá', () => {
    expect(consumirForcadosRegistrado(2, 'pc-1', 'iniciativa')).toBeNull();
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(rolarDadoComForcados(20, 'pc-1', 'iniciativa')).toBe(20);
  });

  it('com consumidor registrado (bundle do mestre), o valor forçado vence a aleatoriedade', () => {
    registrarConsumidorForcados(() => [7]);
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // honesto daria 20
    expect(rolarDadoComForcados(20, 'pc-1', 'iniciativa')).toBe(7);
  });

  it('repassa total de dados, personagem e tipo pro consumidor', () => {
    const espiao = vi.fn().mockReturnValue(null);
    registrarConsumidorForcados(espiao);
    rolarDadosComForcados(3, 6, 'npc-2', 'dano');
    expect(espiao).toHaveBeenCalledWith(3, 'npc-2', 'dano');
  });

  it('completa com valores honestos quando a fila devolve menos dados que o pedido', () => {
    registrarConsumidorForcados(() => [5]); // só o primeiro
    vi.spyOn(Math, 'random').mockReturnValue(0); // honesto daria 1
    expect(rolarDadosComForcados(3, 6, null, 'dano')).toEqual([5, 1, 1]);
  });

  it('limparConsumidorForcados volta ao no-op', () => {
    registrarConsumidorForcados(() => [7]);
    limparConsumidorForcados();
    expect(consumirForcadosRegistrado(1, null, 'teste')).toBeNull();
  });
});
