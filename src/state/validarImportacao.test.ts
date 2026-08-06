import { describe, expect, it } from 'vitest';
import { validarTiposEstado } from './validarImportacao';

const base = () => ({
  fichas: [],
  npcs: [],
  iniciativa: [],
  log: [],
  mapa: { tokens: [] },
  config: {},
});

describe('validarTiposEstado', () => {
  it('estado válido não gera problema nenhum', () => {
    expect(validarTiposEstado(base())).toEqual([]);
  });

  it('campos ausentes (undefined) não são reportados — isso é papel do check de chave obrigatória', () => {
    expect(validarTiposEstado({})).toEqual([]);
  });

  it.each(['fichas', 'npcs', 'iniciativa', 'log'])('"%s" que não é lista gera problema', (campo) => {
    const problemas = validarTiposEstado({ ...base(), [campo]: 'não é lista' });
    expect(problemas).toContain(`"${campo}" deveria ser uma lista`);
  });

  it.each(['mapa', 'config'])('"%s" que não é objeto gera problema', (campo) => {
    const problemas = validarTiposEstado({ ...base(), [campo]: 'não é objeto' });
    expect(problemas).toContain(`"${campo}" deveria ser um objeto`);
  });

  it('"mapa" como array (não objeto) gera problema', () => {
    const problemas = validarTiposEstado({ ...base(), mapa: [] });
    expect(problemas).toContain('"mapa" deveria ser um objeto');
  });

  it('ficha que não é objeto gera problema e não tenta olhar os campos dela', () => {
    const problemas = validarTiposEstado({ ...base(), fichas: ['string solta', null] });
    expect(problemas).toContain('fichas[0] deveria ser um objeto');
    expect(problemas).toContain('fichas[1] deveria ser um objeto');
  });

  it('ficha.nome que não é texto gera problema', () => {
    const problemas = validarTiposEstado({ ...base(), fichas: [{ nome: 123 }] });
    expect(problemas).toContain('"fichas[0].nome" deveria ser texto');
  });

  it('ficha.atributos/pericias que não são objeto geram problema', () => {
    const problemas = validarTiposEstado({ ...base(), fichas: [{ atributos: 'x', pericias: [] }] });
    expect(problemas).toContain('"fichas[0].atributos" deveria ser um objeto');
    expect(problemas).toContain('"fichas[0].pericias" deveria ser um objeto');
  });

  it.each(['traumas', 'armas', 'vinculos', 'kitInvestigacao', 'reguladores', 'surtosAtivos'])(
    'ficha.%s que não é lista gera problema',
    (campo) => {
      const problemas = validarTiposEstado({ ...base(), fichas: [{ [campo]: 'não é lista' }] });
      expect(problemas).toContain(`"fichas[0].${campo}" deveria ser uma lista`);
    },
  );

  it('npc que não é objeto, npc.nome errado e npc.acoes errado geram problema', () => {
    const problemas = validarTiposEstado({ ...base(), npcs: [42, { nome: true, acoes: 'oops' }] });
    expect(problemas).toContain('npcs[0] deveria ser um objeto');
    expect(problemas).toContain('"npcs[1].nome" deveria ser texto');
    expect(problemas).toContain('"npcs[1].acoes" deveria ser uma lista');
  });

  it('mapa.tokens que não é lista gera problema', () => {
    const problemas = validarTiposEstado({ ...base(), mapa: { tokens: 'oops' } });
    expect(problemas).toContain('"mapa.tokens" deveria ser uma lista');
  });

  it.each(['traumas', 'armas', 'vinculos', 'kitInvestigacao', 'reguladores', 'surtosAtivos'])(
    'elemento inválido dentro de ficha.%s gera problema (não só o array em si)',
    (campo) => {
      const problemas = validarTiposEstado({ ...base(), fichas: [{ [campo]: [null, 'string solta', { ok: true }] }] });
      expect(problemas).toContain(`"fichas[0].${campo}[0]" deveria ser um objeto`);
      expect(problemas).toContain(`"fichas[0].${campo}[1]" deveria ser um objeto`);
      expect(problemas).not.toContain(`"fichas[0].${campo}[2]" deveria ser um objeto`);
    },
  );

  it('elemento inválido dentro de npcs[i].acoes gera problema', () => {
    const problemas = validarTiposEstado({ ...base(), npcs: [{ acoes: [null] }] });
    expect(problemas).toContain('"npcs[0].acoes[0]" deveria ser um objeto');
  });

  it('elemento inválido em iniciativa/log/mapa.tokens gera problema — é o que a UI itera com .id sem checar tipo', () => {
    const problemas = validarTiposEstado({
      ...base(),
      iniciativa: [null],
      log: ['string solta'],
      mapa: { tokens: [42] },
    });
    expect(problemas).toContain('"iniciativa[0]" deveria ser um objeto');
    expect(problemas).toContain('"log[0]" deveria ser um objeto');
    expect(problemas).toContain('"mapa.tokens[0]" deveria ser um objeto');
  });

  it('acumula vários problemas ao mesmo tempo, não para no primeiro', () => {
    const problemas = validarTiposEstado({
      ...base(),
      fichas: [{ nome: 1, traumas: 'x' }],
      npcs: 'oops',
    });
    expect(problemas.length).toBeGreaterThanOrEqual(3);
  });
});
