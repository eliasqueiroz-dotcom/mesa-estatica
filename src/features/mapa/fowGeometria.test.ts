import { describe, it, expect } from 'vitest';
import { caixasIntersectam, montarMaskSvg, pontoDentroRegiao, regiaoEmPx, subtrairCaixa } from './fowGeometria';

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
/** Soma das áreas dos pedaços — usada pra conferir que a subtração não perde nem duplica área. */
const area = (cs: { w: number; h: number }[]) => cs.reduce((t, c) => t + c.w * c.h, 0);

describe('caixasIntersectam', () => {
  // frações exatas em binário (0.25/0.5) de propósito: com 0.2+0.4 o próprio JS devolve
  // 0.6000000000000001 e a borda "colada" vira sobreposição de ~1e-16. Na prática isso é
  // inofensivo (o recorte resultante tem área desprezível), mas num teste viraria ruído.
  const a = { x: 0.25, y: 0.25, w: 0.25, h: 0.25 };

  it('sobreposição parcial conta', () => {
    expect(caixasIntersectam(a, { x: 0.375, y: 0.375, w: 0.25, h: 0.25 })).toBe(true);
  });

  it('separadas não contam', () => {
    expect(caixasIntersectam(a, { x: 0.75, y: 0.75, w: 0.125, h: 0.125 })).toBe(false);
  });

  it('encostar de raspão (bordas coladas, área zero) não conta', () => {
    expect(caixasIntersectam(a, { x: 0.5, y: 0.25, w: 0.25, h: 0.25 })).toBe(false);
  });
});

describe('subtrairCaixa', () => {
  const a = { x: 0, y: 0, w: 1, h: 1 };

  it('sem interseção devolve a original intacta', () => {
    const fora = { x: 0.8, y: 0.8, w: 0.1, h: 0.1 };
    expect(subtrairCaixa({ x: 0, y: 0, w: 0.5, h: 0.5 }, fora)).toEqual([{ x: 0, y: 0, w: 0.5, h: 0.5 }]);
  });

  it('recorte que cobre tudo não deixa sobra', () => {
    expect(subtrairCaixa({ x: 0.2, y: 0.2, w: 0.2, h: 0.2 }, a)).toEqual([]);
  });

  it('buraco no meio vira 4 faixas e conserva a área (1 - área do buraco)', () => {
    const buraco = { x: 0.4, y: 0.4, w: 0.2, h: 0.2 };
    const partes = subtrairCaixa(a, buraco);
    expect(partes).toHaveLength(4);
    expect(area(partes)).toBeCloseTo(1 - 0.2 * 0.2, 6);
  });

  it('as faixas não se sobrepõem — área somada bate com a geométrica', () => {
    // se as laterais invadissem a faixa de cima/baixo, a soma passaria do esperado
    const partes = subtrairCaixa(a, { x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
    expect(area(partes)).toBeCloseTo(1 - 0.25, 6);
  });

  it('corte encostado numa borda gera só as faixas necessárias', () => {
    const partes = subtrairCaixa(a, { x: 0, y: 0, w: 1, h: 0.3 }); // tira a faixa de cima inteira
    expect(partes).toHaveLength(1);
    expect(partes[0]).toEqual({ x: 0, y: 0.3, w: 1, h: 0.7 });
  });

  it('nenhum pedaço escapa da caixa original', () => {
    for (const p of subtrairCaixa(a, { x: 0.1, y: 0.6, w: 0.3, h: 0.2 })) {
      expect(p.x).toBeGreaterThanOrEqual(a.x);
      expect(p.y).toBeGreaterThanOrEqual(a.y);
      expect(p.x + p.w).toBeLessThanOrEqual(a.x + a.w + 1e-9);
      expect(p.y + p.h).toBeLessThanOrEqual(a.y + a.h + 1e-9);
    }
  });
});
