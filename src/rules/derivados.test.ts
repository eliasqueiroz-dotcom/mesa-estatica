import { describe, expect, it } from 'vitest';
import {
  calcularAlerta,
  calcularDefesa,
  calcularPvMaximo,
  calcularSanidadeMaxima,
  calcularTierRuido,
  cruzouLinhaDescendo,
  estaFerido,
  metade,
  perdeuCincoOuMaisDeUmaVez,
} from './derivados';

describe('valores derivados', () => {
  it('PV máximo = base + 5×Vigor', () => {
    expect(calcularPvMaximo(20, 3)).toBe(35);
    expect(calcularPvMaximo(10, 0)).toBe(10);
    expect(calcularPvMaximo(30, 5)).toBe(55);
  });

  it('Sanidade máxima = 10 + 5×Vontade', () => {
    expect(calcularSanidadeMaxima(0)).toBe(10);
    expect(calcularSanidadeMaxima(3)).toBe(25);
  });

  it('Defesa = 10 + Agilidade + equipamento', () => {
    expect(calcularDefesa(2, 1)).toBe(13);
    expect(calcularDefesa(0, -1)).toBe(9);
  });

  it('Alerta = 10 + Percepção', () => {
    expect(calcularAlerta(3)).toBe(13);
  });
});

describe('metade (arredondada pra baixo)', () => {
  it('arredonda para baixo em valores ímpares', () => {
    expect(metade(35)).toBe(17);
    expect(metade(10)).toBe(5);
    expect(metade(1)).toBe(0);
  });
});

describe('estaFerido', () => {
  it('PV atual igual à metade conta como Ferido', () => {
    expect(estaFerido(17, 35)).toBe(true);
  });
  it('PV atual um acima da metade não conta como Ferido', () => {
    expect(estaFerido(18, 35)).toBe(false);
  });
  it('0 PV é Ferido', () => {
    expect(estaFerido(0, 20)).toBe(true);
  });
});

describe('cruzouLinhaDescendo', () => {
  it('detecta a transição de cima da linha para baixo/igual', () => {
    expect(cruzouLinhaDescendo(20, 10, 12)).toBe(true);
    expect(cruzouLinhaDescendo(13, 12, 12)).toBe(true);
  });
  it('não dispara se já estava na linha ou abaixo antes', () => {
    expect(cruzouLinhaDescendo(12, 8, 12)).toBe(false);
    expect(cruzouLinhaDescendo(5, 3, 12)).toBe(false);
  });
  it('não dispara subindo', () => {
    expect(cruzouLinhaDescendo(8, 15, 12)).toBe(false);
  });
});

describe('perdeuCincoOuMaisDeUmaVez', () => {
  it('dispara com perda exata de 5', () => {
    expect(perdeuCincoOuMaisDeUmaVez(20, 15)).toBe(true);
  });
  it('dispara com perda maior que 5', () => {
    expect(perdeuCincoOuMaisDeUmaVez(20, 10)).toBe(true);
  });
  it('não dispara com perda de 4', () => {
    expect(perdeuCincoOuMaisDeUmaVez(20, 16)).toBe(false);
  });
  it('não dispara em ganho de Sanidade', () => {
    expect(perdeuCincoOuMaisDeUmaVez(10, 20)).toBe(false);
  });
});

describe('calcularTierRuido', () => {
  it('tier 0 — limpo, acima de 75%', () => {
    expect(calcularTierRuido(20, 20)).toBe(0);
    expect(calcularTierRuido(16, 20)).toBe(0);
  });
  it('tier 1 — interferência, 50–75%', () => {
    expect(calcularTierRuido(15, 20)).toBe(1);
    expect(calcularTierRuido(11, 20)).toBe(1);
  });
  it('tier 2 — ruído, 25–50%, inclui exatamente a linha da metade', () => {
    expect(calcularTierRuido(10, 20)).toBe(2);
    expect(calcularTierRuido(6, 20)).toBe(2);
  });
  it('tier 3 — colapso, ≤25%', () => {
    expect(calcularTierRuido(5, 20)).toBe(3);
    expect(calcularTierRuido(0, 20)).toBe(3);
  });
});
