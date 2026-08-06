import { describe, expect, it } from 'vitest';
import { calcularDanoAtaque, descricaoResultado, inserirNaIniciativa, ordenarIniciativa, parseDanoArma, resolverTeste } from './teste';

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

describe('inserirNaIniciativa', () => {
  const lista = [
    { id: 'a', valor: 20 },
    { id: 'b', valor: 12 },
    { id: 'c', valor: 5 },
  ];

  it('encaixa no meio conforme o valor', () => {
    const r = inserirNaIniciativa(lista, [{ id: 'novo', valor: 15 }]);
    expect(r.map((e) => e.id)).toEqual(['a', 'novo', 'b', 'c']);
  });

  it('valor mais alto vai pro topo', () => {
    const r = inserirNaIniciativa(lista, [{ id: 'novo', valor: 25 }]);
    expect(r.map((e) => e.id)).toEqual(['novo', 'a', 'b', 'c']);
  });

  it('valor mais baixo vai pro fim', () => {
    const r = inserirNaIniciativa(lista, [{ id: 'novo', valor: 1 }]);
    expect(r.map((e) => e.id)).toEqual(['a', 'b', 'c', 'novo']);
  });

  it('empate entra depois de quem já estava na lista', () => {
    const r = inserirNaIniciativa(lista, [{ id: 'novo', valor: 12 }]);
    expect(r.map((e) => e.id)).toEqual(['a', 'b', 'novo', 'c']);
  });

  it('lote de mesmo valor (rolagem em grupo) fica adjacente e na ordem recebida', () => {
    const r = inserirNaIniciativa(lista, [
      { id: 'g1', valor: 15 },
      { id: 'g2', valor: 15 },
      { id: 'g3', valor: 15 },
    ]);
    expect(r.map((e) => e.id)).toEqual(['a', 'g1', 'g2', 'g3', 'b', 'c']);
  });

  it('lista vazia recebe as novas na ordem dada', () => {
    const r = inserirNaIniciativa([], [{ id: 'x', valor: 3 }, { id: 'y', valor: 9 }]);
    expect(r.map((e) => e.id)).toEqual(['y', 'x']);
  });

  it('não muta a lista original', () => {
    const original = [...lista];
    inserirNaIniciativa(lista, [{ id: 'novo', valor: 15 }]);
    expect(lista).toEqual(original);
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

describe('parseDanoArma', () => {
  it('reconhece NdM simples, sem Vigor', () => {
    expect(parseDanoArma('1d6')).toEqual({ qtd: 1, lados: 6, modificador: 0, corpoACorpo: false });
  });

  it('reconhece NdM+K', () => {
    expect(parseDanoArma('2d6+1')).toEqual({ qtd: 2, lados: 6, modificador: 1, corpoACorpo: false });
  });

  it('detecta "Vigor" no texto (soma automática de corpo a corpo, ficha.md)', () => {
    expect(parseDanoArma('1d6 + Vigor')).toEqual({ qtd: 1, lados: 6, modificador: 0, corpoACorpo: true });
  });

  it('"Vigor" funciona junto de um modificador numérico', () => {
    expect(parseDanoArma('1d4+2 + Vigor')).toEqual({ qtd: 1, lados: 4, modificador: 2, corpoACorpo: true });
  });

  it('texto sem termo de dado reconhecível retorna null — campo é livre (ficha.md)', () => {
    expect(parseDanoArma('especial, ver nota')).toBeNull();
    expect(parseDanoArma('')).toBeNull();
  });
});

describe('descricaoResultado', () => {
  it('1 natural → complicação', () => {
    const r = resolverTeste({ d20: 1, atributoId: 'percepcao', valorAtributo: 0, grauPericia: 0, personagemFerido: false, dt: 10 });
    expect(descricaoResultado(r)).toBe('1 natural — complicação');
  });

  it('20 natural → margem garantida', () => {
    const r = resolverTeste({ d20: 20, atributoId: 'percepcao', valorAtributo: 0, grauPericia: 0, personagemFerido: false, dt: 10 });
    expect(descricaoResultado(r)).toBe('20 natural — margem garantida');
  });

  it('margem 10+ → efeito extra', () => {
    const r = resolverTeste({ d20: 18, atributoId: 'percepcao', valorAtributo: 3, grauPericia: 3, personagemFerido: false, dt: 10 });
    expect(descricaoResultado(r)).toBe('margem 10+ — efeito extra');
  });

  it('sucesso normal → "sucesso"', () => {
    const r = resolverTeste({ d20: 12, atributoId: 'percepcao', valorAtributo: 2, grauPericia: 3, personagemFerido: false, dt: 15 });
    expect(descricaoResultado(r)).toBe('sucesso');
  });

  it('falha normal → "falha"', () => {
    const r = resolverTeste({ d20: 5, atributoId: 'percepcao', valorAtributo: 1, grauPericia: 0, personagemFerido: false, dt: 15 });
    expect(descricaoResultado(r)).toBe('falha');
  });
});
