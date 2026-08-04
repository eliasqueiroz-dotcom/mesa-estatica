import { describe, expect, it } from 'vitest';
import type { EntradaLog } from '../state/types';
import {
  decrementarDuracoesCombate,
  estaForaDeCombate,
  filtrarLogDeCombate,
  gerarResumoCombate,
  resolverEstabilizar,
  DT_ESTABILIZAR,
} from './combate';

describe('estaForaDeCombate', () => {
  it('0 PV é fora de combate', () => {
    expect(estaForaDeCombate(0)).toBe(true);
  });

  it('PV negativo (clamps não aplicados aqui) também conta', () => {
    expect(estaForaDeCombate(-3)).toBe(true);
  });

  it('1 PV não é fora de combate', () => {
    expect(estaForaDeCombate(1)).toBe(false);
  });
});

describe('resolverEstabilizar', () => {
  it('sucesso com d20 alto o bastante pra bater DT 15', () => {
    const r = resolverEstabilizar({ d20: 12, intelecto: 2, grauMedicina: 2, socorristaFerido: false });
    // 12 + (2+2) = 16 >= 15
    expect(r.teste.total).toBe(16);
    expect(r.estabilizou).toBe(true);
  });

  it('falha com resultado abaixo de DT 15', () => {
    const r = resolverEstabilizar({ d20: 5, intelecto: 1, grauMedicina: 0, socorristaFerido: false });
    expect(r.teste.total).toBe(6);
    expect(r.estabilizou).toBe(false);
  });

  it('20 natural sempre estabiliza, mesmo sem perícia', () => {
    const r = resolverEstabilizar({ d20: 20, intelecto: 0, grauMedicina: 0, socorristaFerido: false });
    expect(r.estabilizou).toBe(true);
  });

  it('1 natural sempre falha, mesmo com modificador alto', () => {
    const r = resolverEstabilizar({ d20: 1, intelecto: 5, grauMedicina: 5, socorristaFerido: false });
    expect(r.estabilizou).toBe(false);
  });

  it('socorrista ferido leva -2 em Intelecto? não — penalidade de Ferido só afeta Vigor/Agilidade (regras.md)', () => {
    const semFerido = resolverEstabilizar({ d20: 10, intelecto: 2, grauMedicina: 2, socorristaFerido: false });
    const comFerido = resolverEstabilizar({ d20: 10, intelecto: 2, grauMedicina: 2, socorristaFerido: true });
    expect(comFerido.teste.total).toBe(semFerido.teste.total);
  });

  it('usa DT 15 fixo', () => {
    const r = resolverEstabilizar({ d20: 10, intelecto: 0, grauMedicina: 0, socorristaFerido: false });
    expect(r.teste.dt).toBe(DT_ESTABILIZAR);
  });
});

describe('decrementarDuracoesCombate', () => {
  it('sem duração cadastrada, não mexe em nada', () => {
    const condicoesCombate = { p1: ['exposto'] };
    const condicaoDuracao = {};
    const r = decrementarDuracoesCombate(condicoesCombate, condicaoDuracao, 'p1');
    expect(r.condicoesCombate).toBe(condicoesCombate);
    expect(r.condicaoDuracao).toBe(condicaoDuracao);
  });

  it('decrementa sem expirar (ainda > 0)', () => {
    const condicoesCombate = { p1: ['mirando'] };
    const condicaoDuracao = { p1: { mirando: 2 } };
    const r = decrementarDuracoesCombate(condicoesCombate, condicaoDuracao, 'p1');
    expect(r.condicaoDuracao).toEqual({ p1: { mirando: 1 } });
    expect(r.condicoesCombate).toEqual({ p1: ['mirando'] });
  });

  it('chega a 0 e remove a condição de condicoesCombate e condicaoDuracao', () => {
    const condicoesCombate = { p1: ['mirando', 'exposto'] };
    const condicaoDuracao = { p1: { mirando: 1 } };
    const r = decrementarDuracoesCombate(condicoesCombate, condicaoDuracao, 'p1');
    expect(r.condicoesCombate).toEqual({ p1: ['exposto'] });
    expect(r.condicaoDuracao).toEqual({});
  });

  it('remove a entrada do participante quando a última condição expira', () => {
    const condicoesCombate = { p1: ['mirando'] };
    const condicaoDuracao = { p1: { mirando: 1 } };
    const r = decrementarDuracoesCombate(condicoesCombate, condicaoDuracao, 'p1');
    expect(r.condicoesCombate).toEqual({});
    expect('p1' in r.condicaoDuracao).toBe(false);
  });

  it('condição manual (sem duração) junto de uma com duração — só a com duração é afetada', () => {
    const condicoesCombate = { p1: ['mirando', 'coberto'] };
    const condicaoDuracao = { p1: { mirando: 1 } };
    const r = decrementarDuracoesCombate(condicoesCombate, condicaoDuracao, 'p1');
    expect(r.condicoesCombate).toEqual({ p1: ['coberto'] });
  });

  it('não mexe nas condições de outro participante', () => {
    const condicoesCombate = { p1: ['mirando'], p2: ['exposto'] };
    const condicaoDuracao = { p1: { mirando: 1 } };
    const r = decrementarDuracoesCombate(condicoesCombate, condicaoDuracao, 'p1');
    expect(r.condicoesCombate.p2).toEqual(['exposto']);
  });
});

const criarEntradaLog = (overrides: Partial<EntradaLog> = {}): EntradaLog => ({
  id: 'l1',
  timestamp: new Date(0).toISOString(),
  tipo: 'dano',
  personagemId: 'p1',
  texto: 'texto',
  ...overrides,
});

describe('filtrarLogDeCombate', () => {
  it('mantém só tipos de combate (dano, iniciativa, teste)', () => {
    const log = [
      criarEntradaLog({ id: '1', tipo: 'dano' }),
      criarEntradaLog({ id: '2', tipo: 'anotacao' }),
      criarEntradaLog({ id: '3', tipo: 'iniciativa' }),
      criarEntradaLog({ id: '4', tipo: 'dinheiro' }),
      criarEntradaLog({ id: '5', tipo: 'teste' }),
    ];
    expect(filtrarLogDeCombate(log).map((e) => e.id)).toEqual(['1', '3', '5']);
  });

  it('filtra por participante quando informado', () => {
    const log = [
      criarEntradaLog({ id: '1', tipo: 'dano', personagemId: 'p1' }),
      criarEntradaLog({ id: '2', tipo: 'dano', personagemId: 'p2' }),
    ];
    expect(filtrarLogDeCombate(log, 'p1').map((e) => e.id)).toEqual(['1']);
  });

  it('sem participanteId, devolve todas as entradas de combate', () => {
    const log = [criarEntradaLog({ id: '1', personagemId: 'p1' }), criarEntradaLog({ id: '2', personagemId: 'p2' })];
    expect(filtrarLogDeCombate(log).map((e) => e.id)).toEqual(['1', '2']);
  });
});

describe('gerarResumoCombate', () => {
  it('monta o cabeçalho com sessão/cena/rodada', () => {
    const md = gerarResumoCombate({ numeroSessao: 3, contadorCena: 2, rodada: 4, combatentes: [] });
    expect(md).toContain('## Combate — Sessão 3, Cena 2 (Rodada 4)');
  });

  it('lista a iniciativa na ordem recebida', () => {
    const md = gerarResumoCombate({
      numeroSessao: 1,
      contadorCena: 1,
      rodada: 1,
      combatentes: [
        { nome: 'Leo', valor: 24, pvAtual: 18, pvMaximo: 20, condicoes: [] },
        { nome: 'Sargento', valor: 21, pvAtual: 10, pvMaximo: 10, condicoes: [] },
      ],
    });
    expect(md).toContain('**Iniciativa**: Leo 24, Sargento 21');
    expect(md).toContain('**PV**: Leo 18/20, Sargento 10/10');
  });

  it('lista fora de combate só quem está a 0 PV ou menos', () => {
    const md = gerarResumoCombate({
      numeroSessao: 1,
      contadorCena: 1,
      rodada: 1,
      combatentes: [
        { nome: 'Leo', valor: 24, pvAtual: 18, pvMaximo: 20, condicoes: [] },
        { nome: 'Pol3', valor: 5, pvAtual: 0, pvMaximo: 10, condicoes: [] },
      ],
    });
    expect(md).toContain('**Fora de combate**: Pol3');
    expect(md).not.toContain('Fora de combate**: Leo');
  });

  it('sem ninguém fora de combate, omite a linha', () => {
    const md = gerarResumoCombate({
      numeroSessao: 1,
      contadorCena: 1,
      rodada: 1,
      combatentes: [{ nome: 'Leo', valor: 24, pvAtual: 18, pvMaximo: 20, condicoes: [] }],
    });
    expect(md).not.toContain('Fora de combate');
  });

  it('lista condições com nome legível (não o id cru)', () => {
    const md = gerarResumoCombate({
      numeroSessao: 1,
      contadorCena: 1,
      rodada: 1,
      combatentes: [{ nome: 'Leo', valor: 24, pvAtual: 18, pvMaximo: 20, condicoes: ['exposto', 'mirando'] }],
    });
    expect(md).toContain('**Condições**: Leo (Exposto, Mirando)');
  });

  it('não inventa recursos gastos nem XP — só o que o app sabe de verdade', () => {
    const md = gerarResumoCombate({ numeroSessao: 1, contadorCena: 1, rodada: 1, combatentes: [] });
    expect(md.toLowerCase()).not.toContain('recursos');
    expect(md.toLowerCase()).not.toContain('xp');
  });
});
