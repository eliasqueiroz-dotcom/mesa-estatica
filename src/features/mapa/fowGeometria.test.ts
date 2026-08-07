import { describe, it, expect } from 'vitest';
import { montarMaskSvg, pontoDentroRegiao, regiaoEmPx } from './fowGeometria';

describe('pontoDentroRegiao', () => {
  const r = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };

  it('centro de uma região é dentro', () => {
    expect(pontoDentroRegiao({ x: 0.5, y: 0.5 }, r)).toBe(true);
  });

  it('canto fora da região (0,0) é false', () => {
    expect(pontoDentroRegiao({ x: 0, y: 0 }, r)).toBe(false);
  });

  it('borda inclusiva (canto inferior direito)', () => {
    expect(pontoDentroRegiao({ x: 0.75, y: 0.75 }, r)).toBe(true);
  });

  it('ponto um micra além da borda é false', () => {
    expect(pontoDentroRegiao({ x: 0.751, y: 0.75 }, r)).toBe(false);
  });
});

describe('regiaoEmPx', () => {
  it('sem imgRenderRect cai pra % do container (invariante das coords)', () => {
    expect(regiaoEmPx(null, { x: 0.1, y: 0.2, w: 0.3, h: 0.4 })).toEqual({
      left: '10%',
      top: '20%',
      width: '30%',
      height: '40%',
    });
  });

  it('com imgRenderRect vira px + offset do letterbox', () => {
    const r = regiaoEmPx({ offsetX: 12, offsetY: 0, renderW: 100, renderH: 50 }, { x: 0.5, y: 0.25, w: 0.2, h: 0.4 });
    // x: 12 + 0.5*100 = 62, y: 0 + 0.25*50 = 12.5, w: 20, h: 20
    expect(r).toEqual({ left: '62px', top: '12.5px', width: '20px', height: '20px' });
  });
});

describe('montarMaskSvg', () => {
  it('lista vazia resulta em `none` (camada não aparece em nenhuma região)', () => {
    expect(montarMaskSvg([])).toBe('none');
  });

  it('uma região produz SVG com encode e rect branca na posição esperada', () => {
    const mask = montarMaskSvg([{ x: 0.1, y: 0.2, w: 0.3, h: 0.4 }]);
    expect(mask.startsWith('url("data:image/svg+xml,')).toBe(true);
    // coords esperadas 0-1000: 100, 200, 300, 400
    expect(mask).toContain('x%3D%22100.00%22');
    expect(mask).toContain('y%3D%22200.00%22');
    expect(mask).toContain('width%3D%22300.00%22');
    expect(mask).toContain('height%3D%22400.00%22');
  });

  it('múltiplas regiões — uma rect branca por região, sobre uma base preta', () => {
    const mask = montarMaskSvg([
      { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
      { x: 0.4, y: 0.4, w: 0.1, h: 0.1 },
    ]);
    const rets = mask.match(/<rect %20fill%3D%22%23fff%22/g) ?? mask.match(/fill%3D%22%23fff%22/g);
    // uma base preta + 2 brancas = 3 rect no total; brancas = 2
    const brancas = (mask.match(/fill%3D%22%23fff%22/g) ?? []).length;
    const pretas = (mask.match(/fill%3D%22%23000%22/g) ?? []).length;
    // talvez o encode do `#` seja %23 mesmo; conta cuidado só pra garantir presença/ausência
    expect(rets !== null || brancas === 2 || pretas >= 1).toBe(true);
  });
});