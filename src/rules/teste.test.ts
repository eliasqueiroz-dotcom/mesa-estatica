import { describe, expect, it } from 'vitest';
import { calcularDanoAtaque, ordenarIniciativa, resolverTeste } from './teste';

describe('resolverTeste', () => {
  it('sucesso normal quando total >= DT', () => {
    const r = resolverTeste({ d20: 12, atributoId: 'percepcao', valorAtributo: 2, grauPericia: 3, personagemFerido: false, dt: 15 });
    expect(r.total).toBe(17);
    expect(r.sucesso).toBe(true);
    expect(r.margem10Mais).toBe(false);
  });

  it('falha quando total < DT', () => {
    const r = resolverTeste({ d20: 5, atributoId: 'percepcao', valorAtributo: 1, grauPericia: 0, personagemFerido: false, dt: 15 });
    expect(r.sucesso).toBe(false);
  });

  it('1 natural sempre falha, mesmo com total >= DT', () => {
    const r = resolverTeste({ d20: 1, atributoId: 'presenca', valorAtributo: 5, grauPericia: 6, personagemFerido: false, dt: 10 });
    expect(r.total).toBe(12);
    expect(r.sucesso).toBe(false);
    expect(r.natural1).toBe(true);
  });

  it('20 natural sempre sucede com margem, mesmo com total < DT', () => {
    const r = resolverTeste({ d20: 20, atributoId: 'presenca', valorAtributo: 0, grauPericia: 0, personagemFerido: false, dt: 25 });
    expect(r.total).toBe(20);
    expect(r.sucesso).toBe(true);
    expect(r.margem10Mais).toBe(true);
  });

  it('margem de 10+ detectada em sucesso normal', () => {
    const r = resolverTeste({ d20: 18, atributoId: 'vigor', valorAtributo: 3, grauPericia: 3, personagemFerido: false, dt: 10 });
    expect(r.total).toBe(24);
    expect(r.margem10Mais).toBe(true);
  });

  it('Ferido aplica -2 em teste de Vigor', () => {
    const r = resolverTeste({ d20: 10, atributoId: 'vigor', valorAtributo: 3, grauPericia: 0, personagemFerido: true, dt: 10 });
    expect(r.penalidadeFerido).toBe(-2);
    expect(r.total).toBe(11);
  });

  it('Ferido aplica -2 em teste de Agilidade', () => {
    const r = resolverTeste({ d20: 10, atributoId: 'agilidade', valorAtributo: 2, grauPericia: 0, personagemFerido: true, dt: 10 });
    expect(r.penalidadeFerido).toBe(-2);
  });

  it('Ferido NÃO penaliza testes de outros atributos', () => {
    const r = resolverTeste({ d20: 10, atributoId: 'intelecto', valorAtributo: 3, grauPericia: 0, personagemFerido: true, dt: 10 });
    expect(r.penalidadeFerido).toBe(0);
    expect(r.total).toBe(13);
  });
});

describe('ordenarIniciativa', () => {
  it('ordena por d20+Agilidade desc', () => {
    const r = ordenarIniciativa([
      { id: 'a', d20: 10, agilidade: 1 },
      { id: 'b', d20: 15, agilidade: 0 },
    ]);
    expect(r.map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('empate resolvido por maior Agilidade', () => {
    const r = ordenarIniciativa([
      { id: 'baixa-agi', d20: 10, agilidade: 1 },
      { id: 'alta-agi', d20: 8, agilidade: 3 },
    ]);
    expect(r.map((p) => p.id)).toEqual(['alta-agi', 'baixa-agi']);
  });
});

describe('calcularDanoAtaque', () => {
  it('corpo a corpo soma Vigor ao dano rolado', () => {
    expect(calcularDanoAtaque({ rolagemDano: 4, danoMaximoDado: 6, vigor: 3, corpoACorpo: true, margem10Mais: false })).toBe(7);
  });

  it('à distância não soma Vigor', () => {
    expect(calcularDanoAtaque({ rolagemDano: 4, danoMaximoDado: 6, vigor: 3, corpoACorpo: false, margem10Mais: false })).toBe(4);
  });

  it('margem 10+ usa dano máximo do dado em vez da rolagem', () => {
    expect(calcularDanoAtaque({ rolagemDano: 1, danoMaximoDado: 8, vigor: 2, corpoACorpo: true, margem10Mais: true })).toBe(10);
  });
});
