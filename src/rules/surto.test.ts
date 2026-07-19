import { describe, expect, it } from 'vitest';
import { resolverSurto } from './surto';

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
