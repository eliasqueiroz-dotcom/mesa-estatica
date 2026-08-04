import { describe, expect, it } from 'vitest';
import type { FaixaMidia } from '../state/types';
import { paraFaixa, paraLinha } from './midiaFaixasSync';

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
    });

    expect(paraFaixa(linha)).toEqual(faixa);
  });
});
