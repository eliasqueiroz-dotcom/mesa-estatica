import { describe, expect, it } from 'vitest';
import { computarDiffSons, paraLinha, paraSom } from './soundpadSync';

const som = (slot: number, nome: string, extra?: Partial<{ id: string; path: string; url: string }>) => ({
  id: extra?.id ?? `id-${slot}`,
  slot,
  nome,
  path: extra?.path ?? `sfx/${nome}`,
  url: extra?.url ?? `https://x/${nome}`,
});

describe('mapeadores', () => {
  it('paraLinha e paraSom são simétricos (camel ↔ snake)', () => {
    const original = som(2, 'porta');
    expect(paraSom(paraLinha(original))).toEqual(original);
  });

  it('paraLinha traduz path para storage_path', () => {
    expect(paraLinha(som(0, 'tiro')).storage_path).toBe('sfx/tiro');
  });
});

describe('computarDiffSons', () => {
  it('slot novo entra como upsert', () => {
    const { upserts, removidos } = computarDiffSons([], [som(0, 'tiro')]);
    expect(upserts.map((s) => s.slot)).toEqual([0]);
    expect(removidos).toEqual([]);
  });

  it('slot inalterado não gera upsert', () => {
    const lista = [som(0, 'tiro'), som(3, 'porta')];
    const { upserts, removidos } = computarDiffSons(lista, [...lista]);
    expect(upserts).toEqual([]);
    expect(removidos).toEqual([]);
  });

  // substituir o som de um botão troca o id — se o diff fosse por id, viraria
  // "remove um + cria outro", e o delete correria contra o insert (slot é unique).
  it('substituir o som de um slot vira um upsert só, sem remoção', () => {
    const antes = [som(1, 'porta', { id: 'antigo' })];
    const depois = [som(1, 'vidro', { id: 'novo' })];
    const { upserts, removidos } = computarDiffSons(antes, depois);
    expect(upserts.map((s) => s.nome)).toEqual(['vidro']);
    expect(removidos).toEqual([]);
  });

  it('slot esvaziado vira remoção', () => {
    const { upserts, removidos } = computarDiffSons([som(4, 'grito')], []);
    expect(upserts).toEqual([]);
    expect(removidos.map((s) => s.slot)).toEqual([4]);
  });

  it('mexer num slot não afeta os outros', () => {
    const antes = [som(0, 'a'), som(1, 'b')];
    const depois = [som(0, 'a'), som(1, 'b-novo')];
    const { upserts, removidos } = computarDiffSons(antes, depois);
    expect(upserts.map((s) => s.slot)).toEqual([1]);
    expect(removidos).toEqual([]);
  });
});
