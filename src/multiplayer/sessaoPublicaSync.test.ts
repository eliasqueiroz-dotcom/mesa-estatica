import { describe, expect, it } from 'vitest';
import { criarSessaoPublica } from '../state/factories';
import { paraLinha, paraSessaoPublica } from './sessaoPublicaSync';

describe('paraLinha / paraSessaoPublica', () => {
  it('round-trip preserva a sessão pública', () => {
    const sessao = { ...criarSessaoPublica(), nomeDaMesa: 'Estática', cenaAtual: 'beco sem saída', ameaca: 40 };
    const linha = paraLinha(sessao);
    const reconstruida = paraSessaoPublica({ id: 'sessao', ...linha });
    expect(reconstruida).toEqual(sessao);
  });

  it('condicao_duracao ausente (coluna nova, banco antigo) cai pra objeto vazio, não undefined', () => {
    const sessao = criarSessaoPublica();
    const linha = paraLinha(sessao);
    // simula uma linha antiga do banco, sem a coluna condicao_duracao (migração 0015 não rodada)
    const linhaAntiga = { id: 'sessao', ...linha, condicao_duracao: undefined };
    expect(paraSessaoPublica(linhaAntiga).condicaoDuracao).toEqual({});
  });
});
