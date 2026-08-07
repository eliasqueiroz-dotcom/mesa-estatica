import { describe, expect, it } from 'vitest';
import { criarFoWVazio } from '../state/factories';
import { paraEstadoFoW, paraLinha } from './fowSync';

describe('paraLinha / paraEstadoFoW', () => {
  it('round-trip preserva o fow (vistas, visiveisAgora, zonaAtual, ativa)', () => {
    const fow = {
      ...criarFoWVazio(),
      vistas: [{ id: 'r1', forma: 'rect' as const, x: 0, y: 0, w: 0.5, h: 0.5 }],
      visiveisAgora: [{ id: 'r1', forma: 'rect' as const, x: 0, y: 0, w: 0.5, h: 0.5 }],
      zonaAtual: 'corporativo' as const,
      ativa: true,
    };
    const linha = paraLinha(fow);
    expect(linha).toEqual({
      vistas: fow.vistas,
      visiveis_agora: fow.visiveisAgora,
      proximo_id_zona: 'corporativo',
      ativa: true,
    });

    const reconstruido = paraEstadoFoW(linha);
    expect(reconstruido).toEqual(fow);
  });

  it('ativa ausente (coluna nova, banco sem a migration 0028) cai pra false, não undefined', () => {
    // simula uma linha gravada antes da migration 0028 rodar no banco remoto — mesmo cenário
    // que causava o push silencioso do toggle "fow" nunca refletir pro jogador.
    const linhaAntiga = { vistas: [], visiveis_agora: [], proximo_id_zona: null, ativa: null };
    expect(paraEstadoFoW(linhaAntiga).ativa).toBe(false);
  });

  it('vistas/visiveis_agora corrompidos (não-array) caem pra lista vazia', () => {
    // linha corrompida/parcial vinda do banco não deve propagar um `.map`/`.filter` quebrado
    // pro resto do app (mesmo princípio de `validarPayload.ts` nos canais de broadcast).
    const linhaCorrompida = {
      vistas: null as unknown as [],
      visiveis_agora: undefined as unknown as [],
      proximo_id_zona: null,
      ativa: false,
    };
    const estado = paraEstadoFoW(linhaCorrompida);
    expect(estado.vistas).toEqual([]);
    expect(estado.visiveisAgora).toEqual([]);
  });
});
