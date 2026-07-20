import { describe, expect, it, vi } from 'vitest';
import { calcularExpiraSurto, personagemEstaEmSurto, resolverSurto } from './surto';
import type { EstadoSessaoParaSurto } from './surto';

describe('resolverSurto', () => {
  it('resolve as duas entradas da tabela pelos d20 rolados', () => {
    const r = resolverSurto(1, 20);
    expect(r.entradaA.nome).toBe('Fuga cega');
    expect(r.entradaB.nome).toBe('Sintonia');
    expect(r.mesmoNumero).toBe(false);
  });

  it('"o destino insiste" quando os dois d20 batem no mesmo número', () => {
    const r = resolverSurto(7, 7);
    expect(r.mesmoNumero).toBe(true);
    expect(r.entradaA).toEqual(r.entradaB);
  });
});

describe('calcularExpiraSurto', () => {
  it('fora de combate retorna contadorCena', () => {
    const sessao: EstadoSessaoParaSurto = { modoCombate: false, contadorCena: 5, rodada: 1 };
    expect(calcularExpiraSurto(sessao)).toBe(5);
  });

  it('em combate retorna rodada + 1d4+1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.25); // floor(0.25*4) + 1 = 1 + 1 = 2
    const sessao: EstadoSessaoParaSurto = { modoCombate: true, contadorCena: 5, rodada: 3 };
    const resultado = calcularExpiraSurto(sessao);
    expect(resultado).toBe(5); // 3 + 2
    vi.restoreAllMocks();
  });
});

describe('personagemEstaEmSurto', () => {
  const sessaoFora: EstadoSessaoParaSurto = { modoCombate: false, contadorCena: 3, rodada: 1 };
  const sessaoCombate: EstadoSessaoParaSurto = { modoCombate: true, contadorCena: 3, rodada: 4 };

  it('null nunca está em Surto', () => {
    expect(personagemEstaEmSurto(null, sessaoFora)).toBe(false);
    expect(personagemEstaEmSurto(null, sessaoCombate)).toBe(false);
  });

  it('fora de combate: ativo quando === contadorCena', () => {
    expect(personagemEstaEmSurto(3, sessaoFora)).toBe(true);
    expect(personagemEstaEmSurto(2, sessaoFora)).toBe(false);
  });

  it('em combate: ativo enquanto surtoAtivo >= rodada', () => {
    expect(personagemEstaEmSurto(5, sessaoCombate)).toBe(true); // 5 >= 4
    expect(personagemEstaEmSurto(4, sessaoCombate)).toBe(true); // 4 >= 4
    expect(personagemEstaEmSurto(3, sessaoCombate)).toBe(false); // 3 < 4
  });
});
