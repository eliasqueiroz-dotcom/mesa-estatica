import { describe, expect, it } from 'vitest';
import { criarEstadoMidia } from '../state/factories';
import { paraEstadoMidia, paraLinha, type PatchEstadoMidia } from './midiaEstadoSync';

describe('paraLinha / paraEstadoMidia', () => {
  it('round-trip preserva o estado de playback', () => {
    const { atualizadoEm } = criarEstadoMidia();
    const midia: PatchEstadoMidia = {
      faixaAtualId: 'faixa-1',
      tocando: true,
      posicaoSegundos: 42.5,
      modoLoop: 'faixa',
      atualizadoEm,
      volume: 0.6,
    };
    const linha = paraLinha(midia);
    expect(linha).toEqual({
      faixa_atual_id: 'faixa-1',
      tocando: true,
      posicao_segundos: 42.5,
      modo_loop: 'faixa',
      atualizado_em: midia.atualizadoEm,
      volume: 0.6,
    });

    const reconstruido = paraEstadoMidia({ id: 'midia', ...linha });
    expect(reconstruido).toEqual(midia);
  });

  it('faixaAtualId null (nenhuma faixa tocando) sobrevive ao round-trip', () => {
    const midia: PatchEstadoMidia = { ...criarEstadoMidia(), faixaAtualId: null };
    const linha = paraLinha(midia);
    expect(linha.faixa_atual_id).toBeNull();
    expect(paraEstadoMidia({ id: 'midia', ...linha }).faixaAtualId).toBeNull();
  });
});
