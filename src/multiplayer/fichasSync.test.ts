import { describe, expect, it } from 'vitest';
import { criarFichaVazia } from '../state/factories';
import { paraFichaPublica, paraLinhaPublico } from './fichasSync';

describe('paraLinhaPublico / paraFichaPublica', () => {
  it('round-trip preserva id/nome/corVisual/foto (o que FichaPublica cobre)', () => {
    const ficha = {
      ...criarFichaVazia(),
      nome: 'Helena',
      corVisual: '#4fc1d4',
      foto: 'data:image/jpeg;base64,xyz',
    };
    const linha = paraLinhaPublico(ficha, 20);
    expect(linha.id).toBe(ficha.id);
    expect(linha.nome).toBe('Helena');
    expect(linha.cor_visual).toBe('#4fc1d4');
    expect(linha.foto).toBe('data:image/jpeg;base64,xyz');

    const publica = paraFichaPublica(linha);
    expect(publica).toEqual({ id: ficha.id, nome: 'Helena', corVisual: '#4fc1d4', foto: 'data:image/jpeg;base64,xyz' });
  });

  it('calcula pv_maximo e defesa a partir dos atributos e basePV, não copia da ficha', () => {
    const ficha = { ...criarFichaVazia(), atributos: { ...criarFichaVazia().atributos, vigor: 3, agilidade: 2 } };
    const linha = paraLinhaPublico(ficha, 20);
    expect(linha.pv_maximo).toBe(20 + 5 * 3);
    expect(linha.defesa).toBe(10 + 2 + ficha.equipamentoModificadorDefesa);
  });

  it('foto null vira null na linha (não undefined)', () => {
    const linha = paraLinhaPublico({ ...criarFichaVazia(), foto: null }, 20);
    expect(linha.foto).toBeNull();
    expect(paraFichaPublica(linha).foto).toBeNull();
  });
});
