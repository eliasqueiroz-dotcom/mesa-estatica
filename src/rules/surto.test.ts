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

  it('array vazio nunca está em Surto', () => {
    expect(personagemEstaEmSurto([], sessaoFora)).toBe(false);
    expect(personagemEstaEmSurto([], sessaoCombate)).toBe(false);
  });

  it('fora de combate: ativo quando algum expiraEm === contadorCena', () => {
    expect(personagemEstaEmSurto([{ id: '1', expiraEm: 3, escolha: null }], sessaoFora)).toBe(true);
    expect(personagemEstaEmSurto([{ id: '1', expiraEm: 2, escolha: null }], sessaoFora)).toBe(false);
  });

  it('em combate: ativo enquanto algum expiraEm >= rodada', () => {
    expect(personagemEstaEmSurto([{ id: '1', expiraEm: 5, escolha: null }], sessaoCombate)).toBe(true);
    expect(personagemEstaEmSurto([{ id: '1', expiraEm: 4, escolha: null }], sessaoCombate)).toBe(true);
    expect(personagemEstaEmSurto([{ id: '1', expiraEm: 3, escolha: null }], sessaoCombate)).toBe(false);
  });

  it('múltiplos surtos: true se pelo menos um ativo', () => {
    const surtos = [
      { id: '1', expiraEm: 1, escolha: null },  // expirou
      { id: '2', expiraEm: 3, escolha: 'Fuga cega' }, // ativo
    ];
    expect(personagemEstaEmSurto(surtos, sessaoFora)).toBe(true);
  });
});
