import { describe, expect, it } from 'vitest';
import { ehAoeVivo, ehReguaViva } from './validarPayload';

describe('ehReguaViva', () => {
  const valida = {
    id: 'a1',
    autorId: 'a1',
    cor: '#fff',
    pontos: [{ x: 0.1, y: 0.2 }],
    atualizadaEm: 123,
    ativa: true,
  };

  it('aceita uma regua bem formada', () => {
    expect(ehReguaViva(valida)).toBe(true);
  });

  it('rejeita payload sem o campo regua', () => {
    expect(ehReguaViva(undefined)).toBe(false);
    expect(ehReguaViva({ algumaCoisa: 'x' })).toBe(false);
  });

  it('rejeita pontos ausente ou malformado', () => {
    expect(ehReguaViva({ ...valida, pontos: undefined })).toBe(false);
    expect(ehReguaViva({ ...valida, pontos: [{ x: 'nao-numero', y: 0 }] })).toBe(false);
    expect(ehReguaViva({ ...valida, pontos: 'nao-array' })).toBe(false);
  });

  it('rejeita campos com tipo errado', () => {
    expect(ehReguaViva({ ...valida, id: 42 })).toBe(false);
    expect(ehReguaViva({ ...valida, ativa: 'sim' })).toBe(false);
  });
});

describe('ehAoeVivo', () => {
  const valido = {
    forma: 'circulo' as const,
    origem: { x: 0, y: 0 },
    alvo: { x: 0.5, y: 0.5 },
    ativa: false,
  };

  it('aceita um template bem formado', () => {
    expect(ehAoeVivo(valido)).toBe(true);
  });

  it('rejeita forma invalida', () => {
    expect(ehAoeVivo({ ...valido, forma: 'triangulo' })).toBe(false);
  });

  it('rejeita origem/alvo ausentes ou malformados', () => {
    expect(ehAoeVivo({ ...valido, origem: undefined })).toBe(false);
    expect(ehAoeVivo({ ...valido, alvo: { x: 'nao-numero', y: 0 } })).toBe(false);
  });

  it('rejeita payload vazio', () => {
    expect(ehAoeVivo({})).toBe(false);
    expect(ehAoeVivo(null)).toBe(false);
  });
});
