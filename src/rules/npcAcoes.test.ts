import { describe, expect, it, vi } from 'vitest';
import { usarAcaoNpc } from './npcAcoes';

describe('usarAcaoNpc', () => {
  it('registra a rolagem como privada, sempre — GM controla revelar depois', () => {
    const registrarLog = vi.fn();
    const registrarRoll = vi.fn();

    usarAcaoNpc('npc-1', 'Sentinela', { nome: 'garra', bonus: 3, dano: '' }, registrarLog, registrarRoll);

    expect(registrarRoll).toHaveBeenCalledTimes(1);
    expect(registrarRoll.mock.calls[0][0]).toMatchObject({
      origem: 'Sentinela',
      personagemId: 'npc-1',
      visibilidade: 'privada',
    });
  });

  it('formula e total refletem d20 + bônus da ação', () => {
    const registrarLog = vi.fn();
    const registrarRoll = vi.fn();

    usarAcaoNpc('npc-1', 'Sentinela', { nome: 'garra', bonus: 5, dano: '' }, registrarLog, registrarRoll);

    const entrada = registrarRoll.mock.calls[0][0];
    expect(entrada.formula).toBe('d20+5');
    expect(entrada.total).toBe(entrada.bruto + 5);
    expect(entrada.bruto).toBeGreaterThanOrEqual(1);
    expect(entrada.bruto).toBeLessThanOrEqual(20);
  });

  it('bônus negativo formata sem "+" duplicado', () => {
    const registrarLog = vi.fn();
    const registrarRoll = vi.fn();

    usarAcaoNpc('npc-1', 'Sentinela', { nome: 'garra', bonus: -2, dano: '' }, registrarLog, registrarRoll);

    expect(registrarRoll.mock.calls[0][0].formula).toBe('d20-2');
  });

  it('log narrativo continua público (sem flag de visibilidade) e recebe o npcId', () => {
    const registrarLog = vi.fn();
    const registrarRoll = vi.fn();

    usarAcaoNpc('npc-1', 'Sentinela', { nome: 'garra', bonus: 0, dano: '' }, registrarLog, registrarRoll);

    expect(registrarLog).toHaveBeenCalledWith('rolagem-livre', expect.stringContaining('Sentinela · garra'), 'npc-1');
  });

  it('inclui o dano no texto narrativo quando a ação tem fórmula de dano', () => {
    const registrarLog = vi.fn();
    const registrarRoll = vi.fn();

    usarAcaoNpc('npc-1', 'Sentinela', { nome: 'garra', bonus: 0, dano: '1d6+2' }, registrarLog, registrarRoll);

    const texto = registrarLog.mock.calls[0][1] as string;
    expect(texto).toMatch(/dano 1d6\+2 → \d+/);
  });
});
