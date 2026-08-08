import { describe, expect, it } from 'vitest';
import { ehAoeVivo, ehPingVivo, ehReguaViva, ehRolagemAoVivo } from './validarPayload';

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

describe('ehPingVivo', () => {
  const valido = { id: 'p1', autorId: 'mestre', cor: 'var(--rede)', ponto: { x: 0.3, y: 0.7 } };

  it('aceita um ping bem formado', () => {
    expect(ehPingVivo(valido)).toBe(true);
  });

  it('rejeita ponto ausente ou malformado', () => {
    expect(ehPingVivo({ ...valido, ponto: undefined })).toBe(false);
    expect(ehPingVivo({ ...valido, ponto: { x: 'nao-numero', y: 0 } })).toBe(false);
  });

  it('rejeita campos com tipo errado', () => {
    expect(ehPingVivo({ ...valido, id: 42 })).toBe(false);
    expect(ehPingVivo({ ...valido, autorId: null })).toBe(false);
    expect(ehPingVivo({ ...valido, cor: 7 })).toBe(false);
  });

  it('rejeita payload vazio', () => {
    expect(ehPingVivo({})).toBe(false);
    expect(ehPingVivo(null)).toBe(false);
    expect(ehPingVivo(undefined)).toBe(false);
  });
});

describe('ehRolagemAoVivo', () => {
  const valida = {
    id: 'r1',
    termos: [{ sides: 20, qty: 1 }],
    valores: [15],
    colorsetBase: 'rede' as const,
    cor: '#4fc1d4',
    origem: 'Helena',
    tipo: 'teste' as const,
  };

  it('aceita uma rolagem bem formada', () => {
    expect(ehRolagemAoVivo(valida)).toBe(true);
  });

  it('aceita colorsetBase "ruido" (Sanidade/Surto/Trauma)', () => {
    expect(ehRolagemAoVivo({ ...valida, colorsetBase: 'ruido' })).toBe(true);
  });

  it('rejeita colorsetBase fora do conjunto conhecido', () => {
    expect(ehRolagemAoVivo({ ...valida, colorsetBase: 'roxo' })).toBe(false);
  });

  it('rejeita termos ausente, vazio ou malformado', () => {
    expect(ehRolagemAoVivo({ ...valida, termos: undefined })).toBe(false);
    expect(ehRolagemAoVivo({ ...valida, termos: [] })).toBe(false);
    expect(ehRolagemAoVivo({ ...valida, termos: [{ sides: 'nao-numero', qty: 1 }] })).toBe(false);
  });

  it('rejeita valores ausente ou com item não numérico', () => {
    expect(ehRolagemAoVivo({ ...valida, valores: undefined })).toBe(false);
    expect(ehRolagemAoVivo({ ...valida, valores: [15, 'x'] })).toBe(false);
  });

  it('bonus é opcional — ausente continua válido', () => {
    expect(ehRolagemAoVivo(valida)).toBe(true);
  });

  it('aceita bonus numérico (inclusive negativo)', () => {
    expect(ehRolagemAoVivo({ ...valida, bonus: 3 })).toBe(true);
    expect(ehRolagemAoVivo({ ...valida, bonus: -2 })).toBe(true);
  });

  it('rejeita bonus não numérico', () => {
    expect(ehRolagemAoVivo({ ...valida, bonus: 'dois' })).toBe(false);
  });

  it('rejeita campos com tipo errado', () => {
    expect(ehRolagemAoVivo({ ...valida, id: 42 })).toBe(false);
    expect(ehRolagemAoVivo({ ...valida, cor: 7 })).toBe(false);
    expect(ehRolagemAoVivo({ ...valida, origem: null })).toBe(false);
    expect(ehRolagemAoVivo({ ...valida, tipo: 5 })).toBe(false);
  });

  it('rejeita payload vazio', () => {
    expect(ehRolagemAoVivo({})).toBe(false);
    expect(ehRolagemAoVivo(null)).toBe(false);
    expect(ehRolagemAoVivo(undefined)).toBe(false);
  });
});
