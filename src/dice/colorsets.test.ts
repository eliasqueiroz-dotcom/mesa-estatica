import { describe, expect, it } from 'vitest';
import { COLORSETS, colorsetComCor } from './colorsets';

describe('colorsetComCor', () => {
  it('sobrepõe só o foreground (números), mantém fundo/vidro da paleta base', () => {
    const resultado = colorsetComCor('rede', '#ff00ff');
    expect(resultado.foreground).toBe('#ff00ff');
    expect(resultado.background).toBe(COLORSETS.rede.background);
    expect(resultado.outline).toBe(COLORSETS.rede.outline);
  });

  it('funciona também pra base ruido (Sanidade/Surto/Trauma)', () => {
    const resultado = colorsetComCor('ruido', '#00ffcc');
    expect(resultado.foreground).toBe('#00ffcc');
    expect(resultado.background).toBe(COLORSETS.ruido.background);
  });

  it('não muda o COLORSETS original (imutável)', () => {
    colorsetComCor('rede', '#ff00ff');
    expect(COLORSETS.rede.foreground).not.toBe('#ff00ff');
  });
});
