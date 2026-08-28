import { describe, expect, it } from 'vitest';
import { normalizarRecorte } from './comprimirImagem';

describe('normalizarRecorte', () => {
  it('recorte já dentro dos limites da imagem: devolve igual', () => {
    expect(normalizarRecorte({ x: 10, y: 10, width: 100, height: 100 }, 400, 300)).toEqual({
      x: 10,
      y: 10,
      width: 100,
      height: 100,
    });
  });

  it('recorte estourando a borda direita/inferior: clampa x/y pra encaixar', () => {
    expect(normalizarRecorte({ x: 350, y: 250, width: 100, height: 100 }, 400, 300)).toEqual({
      x: 300,
      y: 200,
      width: 100,
      height: 100,
    });
  });

  it('recorte com x/y negativos: clampa pra 0', () => {
    expect(normalizarRecorte({ x: -20, y: -5, width: 100, height: 100 }, 400, 300)).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
  });

  it('recorte maior que a própria imagem: clampa width/height pro tamanho da imagem', () => {
    expect(normalizarRecorte({ x: 0, y: 0, width: 900, height: 900 }, 400, 300)).toEqual({
      x: 0,
      y: 0,
      width: 400,
      height: 300,
    });
  });
});
