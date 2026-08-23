import { describe, expect, it } from 'vitest';
import type { FaixaMidia } from '../state/types';
import { paraFaixa, paraLinha, resolverReplayFaixa } from './midiaFaixasSync';

describe('paraLinha / paraFaixa', () => {
  it('round-trip preserva os campos da faixa', () => {
    const faixa: FaixaMidia = {
      id: 'f1',
      nome: 'Tema da cena',
      path: 'midia/tema.mp3',
      url: 'https://exemplo.supabase.co/storage/v1/object/public/midia/tema.mp3',
      ordem: 3,
      criadoEm: '2026-07-20T10:00:00.000Z',
    };
    const linha = paraLinha(faixa);
    expect(linha).toEqual({
      id: 'f1',
      nome: 'Tema da cena',
      storage_path: 'midia/tema.mp3',
      url: faixa.url,
      ordem: 3,
      criado_em: '2026-07-20T10:00:00.000Z',
      tag: null,
    });

    expect(paraFaixa(linha)).toEqual(faixa);
  });

  it('round-trip preserva a tag quando definida', () => {
    const faixa: FaixaMidia = {
      id: 'f2',
      nome: 'Tensão',
      path: 'midia/tensao.mp3',
      url: 'https://exemplo.supabase.co/storage/v1/object/public/midia/tensao.mp3',
      ordem: 0,
      criadoEm: '2026-07-20T10:00:00.000Z',
      tag: 'tensão',
    };
    const linha = paraLinha(faixa);
    expect(linha.tag).toBe('tensão');
    expect(paraFaixa(linha)).toEqual(faixa);
  });
});

describe('resolverReplayFaixa', () => {
  const faixa: FaixaMidia = { id: 'f1', nome: 'Tema', path: 'midia/tema.mp3', url: 'https://x/tema.mp3', ordem: 0, criadoEm: '2026-07-20T10:00:00.000Z' };

  it('chave normal (id de faixa) que ainda existe localmente devolve a faixa pra reenviar', () => {
    expect(resolverReplayFaixa('f1', [faixa])).toEqual(faixa);
  });

  it('chave normal que não existe mais localmente devolve null', () => {
    expect(resolverReplayFaixa('sumiu', [faixa])).toBeNull();
  });

  it('chave "delete:<id>" sempre devolve \'apagar\'', () => {
    expect(resolverReplayFaixa('delete:x', [faixa])).toBe('apagar');
    expect(resolverReplayFaixa('delete:x', [])).toBe('apagar');
  });
});
