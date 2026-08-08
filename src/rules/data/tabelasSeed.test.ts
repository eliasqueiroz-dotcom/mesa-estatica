import { describe, it, expect } from 'vitest';
import { criarTabelasSeed, resolverTabela, validarCoberturaTabela } from './tabelasSeed';

describe('criarTabelasSeed', () => {
  it('cria 3 tabelas default', () => {
    const tabelas = criarTabelasSeed();
    expect(tabelas).toHaveLength(3);
    expect(tabelas.map((t) => t.nome).sort()).toEqual(['encontros de rua', 'gancho de surto', 'ruídos noturnos']);
  });

  it('cada tabela tem entradas cobrindo todo o range sem gaps nem overlaps', () => {
    const tabelas = criarTabelasSeed();
    for (const t of tabelas) {
      const problemas = validarCoberturaTabela(t);
      expect(problemas, `tabela "${t.nome}": ${problemas.join('; ')}`).toEqual([]);
    }
  });

  it('cada chamada gera ids diferentes (UUIDs frescos)', () => {
    const a = criarTabelasSeed();
    const b = criarTabelasSeed();
    expect(a[0].id).not.toBe(b[0].id);
    expect(a[0].entradas[0].id).not.toBe(b[0].entradas[0].id);
  });
});

describe('resolverTabela', () => {
  it('encontra a entrada correta pra d20 = 11', () => {
    const tabela = criarTabelasSeed().find((t) => t.nome === 'encontros de rua')!;
    const e = resolverTabela(tabela, 11);
    expect(e?.min).toBe(10);
    expect(e?.max).toBe(12);
    expect(e?.texto).toContain('estabilizador');
  });

  it('encontra a entrada pra d6 = 6', () => {
    const tabela = criarTabelasSeed().find((t) => t.nome === 'ruídos noturnos')!;
    const e = resolverTabela(tabela, 6);
    expect(e?.texto).toContain('silêncio total');
  });

  it('encontra a entrada pra d4 = 1', () => {
    const tabela = criarTabelasSeed().find((t) => t.nome === 'gancho de surto')!;
    const e = resolverTabela(tabela, 1);
    expect(e?.texto).toContain('repete a última frase');
  });
});

describe('validarCoberturaTabela', () => {
  it('tabela perfeita não gera problemas', () => {
    const t = {
      id: 't1',
      nome: 'test',
      lados: 4,
      entradas: [
        { id: 'e1', min: 1, max: 2, texto: 'a' },
        { id: 'e2', min: 3, max: 4, texto: 'b' },
      ],
    };
    expect(validarCoberturaTabela(t)).toEqual([]);
  });

  it('gap gera problema', () => {
    const t = {
      id: 't1',
      nome: 'test',
      lados: 6,
      entradas: [
        { id: 'e1', min: 1, max: 2, texto: 'a' },
        { id: 'e2', min: 4, max: 6, texto: 'b' }, // gap no 3
      ],
    };
    const problemas = validarCoberturaTabela(t);
    expect(problemas.some((p) => p.includes('gap: valor 3'))).toBe(true);
  });

  it('overlap gera problema', () => {
    const t = {
      id: 't1',
      nome: 'test',
      lados: 4,
      entradas: [
        { id: 'e1', min: 1, max: 3, texto: 'a' },
        { id: 'e2', min: 3, max: 4, texto: 'b' }, // overlap no 3
      ],
    };
    const problemas = validarCoberturaTabela(t);
    expect(problemas.some((p) => p.includes('sobrepõe valor 3'))).toBe(true);
  });

  it('min > max gera problema', () => {
    const t = {
      id: 't1',
      nome: 'test',
      lados: 4,
      entradas: [
        { id: 'e1', min: 3, max: 1, texto: 'a' },
        { id: 'e2', min: 1, max: 4, texto: 'b' },
      ],
    };
    const problemas = validarCoberturaTabela(t);
    expect(problemas.some((p) => p.includes('min > max'))).toBe(true);
  });
});