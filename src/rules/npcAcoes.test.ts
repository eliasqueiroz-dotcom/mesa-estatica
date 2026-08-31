import { afterEach, describe, expect, it, vi } from 'vitest';
import { criarNpcVazio } from '../state/factories';
import { useRolagemAoVivoStore } from '../state/rolagemAoVivoStore';
import type { NpcAcao } from '../state/types';
import { rolarAtaqueNpc, rolarDanoNpcArma } from './npcAcoes';

const acao = (dano: string, bonus = 3): NpcAcao => ({ id: 'acao-1', nome: 'garra', bonus, dano });

afterEach(() => {
  useRolagemAoVivoStore.setState({ atual: null, mostrando: false });
});

describe('rolarAtaqueNpc', () => {
  it('total = d20 + bônus fixo (sem lookup de perícia/atributo — NPC não tem nenhum dos dois)', () => {
    const npc = { ...criarNpcVazio(), id: 'npc-1', nome: 'Sentinela' };
    const registrarLog = vi.fn();
    const registrarRoll = vi.fn();

    const r = rolarAtaqueNpc(npc, 'garra', 5, 12, registrarLog, registrarRoll, 'publica');

    expect(r.total).toBe(17);
    expect(registrarRoll).toHaveBeenCalledWith(
      expect.objectContaining({ origem: 'Sentinela', personagemId: 'npc-1', formula: 'd20+5', total: 17, bruto: 12, visibilidade: 'publica' }),
    );
    expect(registrarLog).toHaveBeenCalledWith('teste', expect.stringContaining('Sentinela - garra: Ataque'), 'npc-1', 'publica');
  });

  it('bônus negativo formata sem "+" duplicado', () => {
    const npc = { ...criarNpcVazio(), id: 'npc-1', nome: 'Sentinela' };
    const registrarRoll = vi.fn();

    rolarAtaqueNpc(npc, 'garra', -2, 10, vi.fn(), registrarRoll, 'publica');

    expect(registrarRoll.mock.calls[0][0].formula).toBe('d20-2');
  });

  it('só publica em rolagemAoVivoStore quando pública — privada não anima no header de ninguém', () => {
    const npc = { ...criarNpcVazio(), id: 'npc-1', nome: 'Sentinela' };

    rolarAtaqueNpc(npc, 'garra', 3, 10, vi.fn(), vi.fn(), 'privada');
    expect(useRolagemAoVivoStore.getState().atual).toBeNull();

    rolarAtaqueNpc(npc, 'garra', 3, 10, vi.fn(), vi.fn(), 'publica');
    expect(useRolagemAoVivoStore.getState().atual).toMatchObject({ origem: 'Sentinela', tipo: 'teste', valores: [10], bonus: 3 });
  });
});

describe('rolarDanoNpcArma', () => {
  it('sem Vigor (NPC não tem esse atributo) — total é só a soma dos dados', () => {
    const npc = { ...criarNpcVazio(), id: 'npc-1', nome: 'Sentinela' };
    const registrarLog = vi.fn();
    const registrarRoll = vi.fn();

    const r = rolarDanoNpcArma(npc, acao('1d6'), [{ sides: 6, qty: 1 }], [4], registrarLog, registrarRoll, 'publica');

    expect(r.total).toBe(4);
    expect(registrarRoll).toHaveBeenCalledWith(expect.objectContaining({ origem: 'Sentinela', personagemId: 'npc-1', total: 4, bruto: 4, visibilidade: 'publica' }));
    expect(registrarLog).toHaveBeenCalledWith('dano', expect.stringContaining('Sentinela - Dano: garra'), 'npc-1', 'publica');
  });

  it('só publica em rolagemAoVivoStore quando pública', () => {
    const npc = { ...criarNpcVazio(), id: 'npc-1', nome: 'Sentinela', corVisual: '#123456' };

    rolarDanoNpcArma(npc, acao('1d6'), [{ sides: 6, qty: 1 }], [5], vi.fn(), vi.fn(), 'privada');
    expect(useRolagemAoVivoStore.getState().atual).toBeNull();

    rolarDanoNpcArma(npc, acao('1d6'), [{ sides: 6, qty: 1 }], [5], vi.fn(), vi.fn(), 'publica');
    expect(useRolagemAoVivoStore.getState().atual).toMatchObject({ origem: 'Sentinela', cor: '#123456', tipo: 'dano', valores: [5], bonus: 0 });
  });

  it('fórmula não reconhecida: loga o erro mas não publica rolagem ao vivo (nada pra animar)', () => {
    const npc = { ...criarNpcVazio(), id: 'npc-1', nome: 'Sentinela' };
    const registrarLog = vi.fn();
    const registrarRoll = vi.fn();

    const r = rolarDanoNpcArma(npc, acao('especial, ver nota'), [], [], registrarLog, registrarRoll, 'publica');

    expect(r.erro).toBe(true);
    expect(registrarRoll).toHaveBeenCalledTimes(1);
    expect(useRolagemAoVivoStore.getState().atual).toBeNull();
  });
});
