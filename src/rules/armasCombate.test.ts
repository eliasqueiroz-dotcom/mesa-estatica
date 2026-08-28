import { afterEach, describe, expect, it, vi } from 'vitest';
import { criarFichaVazia } from '../state/factories';
import { useRolagemAoVivoStore } from '../state/rolagemAoVivoStore';
import type { ArmaFicha } from '../state/types';
import { rolarDanoArmaFicha } from './armasCombate';

const arma = (dano: string): ArmaFicha => ({ id: 'arma-1', nome: 'faca', bonusAtaque: '', dano, alcance: '', nota: '', periciaAtaqueId: null });

afterEach(() => {
  useRolagemAoVivoStore.setState({ atual: null, mostrando: false });
});

describe('rolarDanoArmaFicha', () => {
  it('registra o dano como público, com o personagem certo', () => {
    const ficha = { ...criarFichaVazia(), nome: 'Ana', atributos: { ...criarFichaVazia().atributos, vigor: 3 } };
    const registrarLog = vi.fn();
    const registrarRoll = vi.fn();

    rolarDanoArmaFicha(ficha, arma('1d6 + Vigor'), [{ sides: 6, qty: 1 }], [4], false, registrarLog, registrarRoll);

    expect(registrarRoll).toHaveBeenCalledTimes(1);
    expect(registrarRoll.mock.calls[0][0]).toMatchObject({
      origem: 'Ana',
      personagemId: ficha.id,
      total: 7,
      bruto: 4,
      visibilidade: 'publica',
    });
    expect(registrarLog).toHaveBeenCalledWith('dano', expect.stringContaining('Ana · faca ·'), ficha.id);
  });

  it('publica em rolagemAoVivoStore — mestre e jogador, sem exceção (decisão desta feature)', () => {
    const ficha = { ...criarFichaVazia(), nome: 'Bea', corVisual: '#123456' };
    const registrarLog = vi.fn();
    const registrarRoll = vi.fn();

    rolarDanoArmaFicha(ficha, arma('1d6'), [{ sides: 6, qty: 1 }], [5], false, registrarLog, registrarRoll);

    const atual = useRolagemAoVivoStore.getState().atual;
    expect(atual).not.toBeNull();
    expect(atual).toMatchObject({ origem: 'Bea', cor: '#123456', tipo: 'dano', valores: [5] });
  });

  it('crítico: publica os valores fornecidos (já o máximo do dado, decidido por quem chama)', () => {
    const ficha = criarFichaVazia();
    rolarDanoArmaFicha(ficha, arma('1d6'), [{ sides: 6, qty: 1 }], [6], true, vi.fn(), vi.fn());

    expect(useRolagemAoVivoStore.getState().atual?.valores).toEqual([6]);
  });

  it('fórmula não reconhecida: loga o erro mas NÃO publica rolagem ao vivo (nada pra animar)', () => {
    const ficha = criarFichaVazia();
    const registrarLog = vi.fn();
    const registrarRoll = vi.fn();

    const resultado = rolarDanoArmaFicha(ficha, arma('especial, ver nota'), [], [], false, registrarLog, registrarRoll);

    expect(resultado.erro).toBe(true);
    expect(registrarRoll).toHaveBeenCalledTimes(1); // ainda registra no histórico, como ArmasSection.tsx já fazia
    expect(useRolagemAoVivoStore.getState().atual).toBeNull();
  });
});
