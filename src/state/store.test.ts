import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarStorageComDebounce, migrate, useStore } from './store';
import { calcularSanidadeMaxima } from '../rules/derivados';
import { criarEstadoInicial, criarFichaVazia, criarGradeInicial } from './factories';
import { TABELA_SURTO } from '../rules/data/surto';
import { useStatusMesa } from '../lib/statusMesa';

beforeEach(() => {
  useStore.setState(criarEstadoInicial());
});

describe('avancarCena', () => {
  it('incrementa contadorCena', () => {
    useStore.setState({ sessaoPublica: { ...useStore.getState().sessaoPublica, contadorCena: 5 } });
    useStore.getState().avancarCena();
    expect(useStore.getState().sessaoPublica.contadorCena).toBe(6);
  });

  it('remove surto com expiraEm === novaCena', () => {
    const ficha = criarFichaVazia();
    ficha.surtosAtivos = [{ id: '1', expiraEm: 2, escolha: 'Fuga cega' }, { id: '2', expiraEm: 3, escolha: 'Fúria' }];
    useStore.setState({ fichas: [ficha], sessaoPublica: { ...useStore.getState().sessaoPublica, contadorCena: 1 } });
    useStore.getState().avancarCena(); // 1 -> 2
    const fichas = useStore.getState().fichas;
    expect(fichas[0].surtosAtivos).toHaveLength(1);
    expect(fichas[0].surtosAtivos[0].id).toBe('2');
  });

  it('mantém surto com expiraEm > novaCena', () => {
    const ficha = criarFichaVazia();
    ficha.surtosAtivos = [{ id: '1', expiraEm: 5, escolha: 'Fúria' }];
    useStore.setState({ fichas: [ficha] });
    useStore.getState().avancarCena(); // 1 -> 2
    expect(useStore.getState().fichas[0].surtosAtivos).toHaveLength(1);
  });

  it('só remove surto com expiraEm === novaCena — expiraEm anterior não é limpo retroativamente', () => {
    // Documenta o filtro real da store (`surto.expiraEm !== novaCena`): ele não trata "menor
    // que" como expirado, só a correspondência exata. Na criação normal (ajustarSanidadeAtual)
    // expiraEm é sempre contadorCena+1, então isso nunca ocorre em uso normal — mas um estado
    // corrompido/importado com expiraEm defasado sobrevive a avancarCena indefinidamente.
    const ficha = criarFichaVazia();
    ficha.surtosAtivos = [{ id: '1', expiraEm: 1, escolha: 'Fuga cega' }];
    useStore.setState({ fichas: [ficha], sessaoPublica: { ...useStore.getState().sessaoPublica, contadorCena: 1 } });
    useStore.getState().avancarCena(); // 1 -> 2
    expect(useStore.getState().fichas[0].surtosAtivos).toHaveLength(1);
  });

  it('não quebra se surtosAtivos for undefined', () => {
    const ficha = criarFichaVazia();
    delete (ficha as any).surtosAtivos;
    useStore.setState({ fichas: [ficha] });
    expect(() => useStore.getState().avancarCena()).not.toThrow();
  });

  it('incrementa contadorCena', () => {
    expect(useStore.getState().sessaoPublica.contadorCena).toBe(1);
    useStore.getState().avancarCena();
    expect(useStore.getState().sessaoPublica.contadorCena).toBe(2);
    useStore.getState().avancarCena();
    expect(useStore.getState().sessaoPublica.contadorCena).toBe(3);
  });
});

describe('ajustarSanidadeAtual', () => {
  function adicionarFicha(sanidadeAtual: number, vontade: number = 5): string {
    const ficha = criarFichaVazia();
    ficha.sanidadeAtual = sanidadeAtual;
    ficha.atributos.vontade = vontade;
    useStore.setState({ fichas: [ficha] });
    return ficha.id;
  }

  it('atualiza sanidade dentro dos limites', () => {
    const id = adicionarFicha(10);
    useStore.getState().ajustarSanidadeAtual(id, 3);
    expect(useStore.getState().fichas[0].sanidadeAtual).toBe(3);
  });

  it('não negativa', () => {
    const id = adicionarFicha(5);
    useStore.getState().ajustarSanidadeAtual(id, -10);
    expect(useStore.getState().fichas[0].sanidadeAtual).toBe(0);
  });

  it('não ultrapassa máxima', () => {
    const id = adicionarFicha(8);
    const max = calcularSanidadeMaxima(useStore.getState().fichas[0].atributos.vontade);
    useStore.getState().ajustarSanidadeAtual(id, max + 15); // bem acima do máximo, pra testar o clamp de verdade
    expect(useStore.getState().fichas[0].sanidadeAtual).toBe(max);
  });

  it('dispara surto quando perde 5+ de uma vez', () => {
    const id = adicionarFicha(10);
    // d20 diferentes (3 e 11) — sem travar, os dois rolamentos tinham 1/20 de chance de
    // empatar e derrubar esse teste de vez em quando (flakou de verdade em CI em 24/07).
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.5);
    useStore.getState().ajustarSanidadeAtual(id, 4);
    vi.restoreAllMocks();
    expect(useStore.getState().escolhasSurtoPendentes[id]).toBeDefined();
  });

  it('cria entrada com escolha pendente quando d20 diferem', () => {
    const id = adicionarFicha(10);
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.5);
    useStore.getState().ajustarSanidadeAtual(id, 4);
    vi.restoreAllMocks();
    const pendente = useStore.getState().escolhasSurtoPendentes[id];
    expect(pendente).toBeDefined();
    expect(pendente.entradaA).not.toEqual(pendente.entradaB);
  });

  it('d20 iguais: resolve direto, sem pendência de escolha — o resultado já entra em surtosAtivos', () => {
    const id = adicionarFicha(10);
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // mesmo valor pros dois d20 → "mesmoNumero"
    useStore.getState().ajustarSanidadeAtual(id, 4);
    expect(useStore.getState().escolhasSurtoPendentes[id]).toBeUndefined();
    const ficha = useStore.getState().fichas.find((f) => f.id === id)!;
    expect(ficha.surtosAtivos).toHaveLength(1);
    expect(ficha.surtosAtivos[0].escolha).not.toBeNull();
    vi.restoreAllMocks();
  });

  it('incrementa estatística de surtos', () => {
    const id = adicionarFicha(10);
    useStore.getState().ajustarSanidadeAtual(id, 4);
    expect(useStore.getState().sessaoPrivada.estatisticas.surtos).toBe(1);
  });
});

describe('resolverEscolhaSurtoPendente', () => {
  function adicionarFicha(sanidadeAtual: number, vontade: number = 5): string {
    const ficha = criarFichaVazia();
    ficha.sanidadeAtual = sanidadeAtual;
    ficha.atributos.vontade = vontade;
    useStore.setState({ fichas: [ficha] });
    return ficha.id;
  }

  it('atualiza escolha do surto pendente', () => {
    const id = adicionarFicha(10);
    // d20 forçados a diferir (0.1→3, 0.9→19) — garante a pendência de escolha em vez de
    // depender da sorte de dois d20 reais nunca baterem (~5% de chance de falso negativo).
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.9);
    useStore.getState().ajustarSanidadeAtual(id, 4);
    vi.restoreAllMocks();
    const pendente = useStore.getState().escolhasSurtoPendentes[id];
    expect(pendente).toBeDefined();
    useStore.getState().resolverEscolhaSurtoPendente(id, 'A');
    const ficha = useStore.getState().fichas.find((f) => f.id === id)!;
    expect(ficha.surtosAtivos[ficha.surtosAtivos.length - 1].escolha).toBe(pendente.entradaA.nome);
  });

  it('não duplica entradas', () => {
    const id = adicionarFicha(10);
    useStore.getState().ajustarSanidadeAtual(id, 4);
    useStore.getState().resolverEscolhaSurtoPendente(id, 'A');
    expect(useStore.getState().escolhasSurtoPendentes[id]).toBeUndefined();
  });

  it('limpa escolha pendente após resolver', () => {
    const id = adicionarFicha(10);
    useStore.getState().ajustarSanidadeAtual(id, 4);
    useStore.getState().resolverEscolhaSurtoPendente(id, 'A');
    expect(useStore.getState().escolhasSurtoPendentes[id]).toBeUndefined();
  });

  it('não quebra se não há pendente', () => {
    const id = adicionarFicha(10);
    expect(() => useStore.getState().resolverEscolhaSurtoPendente(id, 'A')).not.toThrow();
  });

  describe('surtosAtivos undefined', () => {
    it('ajustarSanidadeAtual não quebra se surtosAtivos for undefined', () => {
      const id = adicionarFicha(10);
      delete (useStore.getState().fichas[0] as any).surtosAtivos;
      expect(() => useStore.getState().ajustarSanidadeAtual(id, 5)).not.toThrow();
      const ficha = useStore.getState().fichas.find((f) => f.id === id)!;
      expect(ficha.sanidadeAtual).toBe(5);
    });

    it('resolverEscolhaSurtoPendente não quebra se surtosAtivos for undefined', () => {
      const id = adicionarFicha(10);
      useStore.setState({
        escolhasSurtoPendentes: {
          [id]: {
            nomeFicha: 'Teste',
            entradaA: TABELA_SURTO.find((e) => e.d20 === 1)!,
            entradaB: TABELA_SURTO.find((e) => e.d20 === 20)!,
          },
        },
      });
      expect(() => useStore.getState().resolverEscolhaSurtoPendente(id, 'A')).not.toThrow();
    });

    it('avancarCena não quebra se surtosAtivos for undefined', () => {
      const ficha = criarFichaVazia();
      delete (ficha as any).surtosAtivos;
      useStore.setState({ fichas: [ficha] });
      expect(() => useStore.getState().avancarCena()).not.toThrow();
    });
  });
});

describe('npcs.acoes undefined', () => {
  function npcSemAcoes(): string {
    useStore.getState().adicionarNpc();
    const npcId = useStore.getState().npcs[0].id;
    useStore.setState((s) => ({
      npcs: s.npcs.map((n) => {
        if (n.id !== npcId) return n;
        const { acoes: _, ...rest } = n as any;
        return rest as any;
      }),
    }));
    return npcId;
  }

  it('salvarNovaAcao não quebra se acoes for undefined', () => {
    const npcId = npcSemAcoes();
    const npc = useStore.getState().npcs.find((n) => n.id === npcId) as any;
    const novaAcao = { id: 'a1', nome: 'Ataque', bonus: 5, dano: '1d6' };
    expect(() =>
      useStore.getState().atualizarNpc(npcId, { acoes: [...(npc.acoes ?? []), novaAcao] }),
    ).not.toThrow();
  });

  it('atualizarNpc com patch de acoes não quebra se array for undefined', () => {
    const npcId = npcSemAcoes();
    const novaAcao = { id: 'a1', nome: 'Ataque', bonus: 5, dano: '1d6' };
    useStore.getState().atualizarNpc(npcId, { acoes: [novaAcao] });
    const npc = useStore.getState().npcs.find((n) => n.id === npcId)!;
    expect(npc.acoes).toEqual([novaAcao]);
  });
});

describe('undefined em arrays aninhados', () => {
  it('registrarRoll não quebra se rollsLog for undefined', () => {
    useStore.setState({ rollsLog: undefined as any });
    expect(() =>
      useStore.getState().registrarRoll({
        origem: 'teste',
        personagemId: null,
        formula: '1d20',
        total: 10,
        bruto: 10,
        visibilidade: 'publica',
      }),
    ).not.toThrow();
    expect(useStore.getState().rollsLog.length).toBe(1);
  });

  it('condicoesCombate undefined não quebra alternarCondicaoCombate', () => {
    useStore.setState((s) => ({
      sessaoPublica: { ...s.sessaoPublica, condicoesCombate: undefined as any },
    }));
    expect(() => useStore.getState().alternarCondicaoCombate('pc-1', 'cond-1')).not.toThrow();
  });
});

// ===== importarJSON =====
describe('importarJSON', () => {
  beforeEach(() => {
    useStore.getState().resetarEstado();
  });

  it('importa JSON válido e normaliza campos', () => {
    const json = JSON.stringify({
      schemaVersion: 10,
      sessaoPublica: { nomeDaMesa: 'Teste', numeroSessao: 1, clima: 'garoa', hora: '20:00', cenaAtual: 'cena 1', caso: '', localAtual: '', objetivo: '', progresso: { atual: 0, total: 0 }, atmosfera: '', contadorCena: 1, modoCombate: false, indiceAtualTurno: 0, rodada: 1, condicoesCombate: {} },
      sessaoPrivada: { oQueRealmenteAcontece: '', proximoEvento: '', lembretes: [], eventos: [], tensao: 0, ruidoNarrativo: 0, ameaca: 0, estatisticas: { rolagens: 0, surtos: 0, mortes: 0, iniciadaEm: null }, dificuldadeCena: 'media', dificuldadeCenaCustom: 15, selecionadosIniciativa: [] },
      fichas: [],
      fichaAtivaId: null,
      npcs: [],
      iniciativa: [],
      mapa: { imagemDataUrl: null, tokens: [], grade: { ativa: false, x: 0, y: 0, largura: 100, altura: 100, colunas: 10, linhas: 10 } },
      log: [],
      rollsLog: [],
      config: { basePV: 20 },
    });
    useStore.getState().importarJSON(json);
    expect(useStore.getState().npcs).toEqual([]);
  });

  it('normaliza NPCs sem acoes (JSON antigo)', () => {
    const npcAntigo = { id: 'n1', nome: 'Bandido', corVisual: '#7d8594', pvAtual: 10, pvMaximo: 10, defesa: 10, agilidade: 1, notas: '', visivel: false, notasMestre: '', categoria: '' };
    const json = JSON.stringify({
      schemaVersion: 10,
      sessaoPublica: { nomeDaMesa: 'Teste', numeroSessao: 1, clima: 'garoa', hora: '20:00', cenaAtual: 'cena 1', caso: '', localAtual: '', objetivo: '', progresso: { atual: 0, total: 0 }, atmosfera: '', contadorCena: 1, modoCombate: false, indiceAtualTurno: 0, rodada: 1, condicoesCombate: {} },
      sessaoPrivada: { oQueRealmenteAcontece: '', proximoEvento: '', lembretes: [], eventos: [], tensao: 0, ruidoNarrativo: 0, ameaca: 0, estatisticas: { rolagens: 0, surtos: 0, mortes: 0, iniciadaEm: null }, dificuldadeCena: 'media', dificuldadeCenaCustom: 15, selecionadosIniciativa: [] },
      fichas: [],
      fichaAtivaId: null,
      npcs: [npcAntigo],
      iniciativa: [],
      mapa: { imagemDataUrl: null, tokens: [], grade: { ativa: false, x: 0, y: 0, largura: 100, altura: 100, colunas: 10, linhas: 10 } },
      log: [],
      rollsLog: [],
      config: { basePV: 20 },
    });
    useStore.getState().importarJSON(json);
    const npcs = useStore.getState().npcs;
    expect(npcs[0].acoes).toEqual([]);
    expect(npcs[0].visivel).toBe(false);
    expect(npcs[0].notasMestre).toBe('');
    expect(npcs[0].categoria).toBe('');
  });

  it('normaliza ficha sem surtosAtivos e campos opcionais', () => {
    const fichaAntiga = { id: 'f1', corVisual: '#4fc1d4', nome: 'Teste', jogador: '', antecedenteId: null, motivo: '', perguntaQueTeDefine: '', respostaPergunta: '', gancho: '', vinculos: [], atributos: { vigor: 2, agilidade: 1, intelecto: 1, percepcao: 1, presenca: 1, vontade: 1 }, pvAtual: 20, sanidadeAtual: 10, equipamentoModificadorDefesa: 0, determinacao: 1, pericias: {}, traumas: [], kitAntecedente: '', contatoOuRecurso: '', contatoUsadoNesteCaso: false, outrosItens: '', armas: [], reguladores: [], acessos: 0, anestesiaAte: null, dinheiroReal: 500, dinheiroPonto: 800, anotacoes: '' };
    const json = JSON.stringify({
      schemaVersion: 10,
      sessaoPublica: { nomeDaMesa: 'Teste', numeroSessao: 1, clima: 'garoa', hora: '20:00', cenaAtual: 'cena 1', caso: '', localAtual: '', objetivo: '', progresso: { atual: 0, total: 0 }, atmosfera: '', contadorCena: 1, modoCombate: false, indiceAtualTurno: 0, rodada: 1, condicoesCombate: {} },
      sessaoPrivada: { oQueRealmenteAcontece: '', proximoEvento: '', lembretes: [], eventos: [], tensao: 0, ruidoNarrativo: 0, ameaca: 0, estatisticas: { rolagens: 0, surtos: 0, mortes: 0, iniciadaEm: null }, dificuldadeCena: 'media', dificuldadeCenaCustom: 15, selecionadosIniciativa: [] },
      fichas: [fichaAntiga],
      fichaAtivaId: null,
      npcs: [],
      iniciativa: [],
      mapa: { imagemDataUrl: null, tokens: [], grade: { ativa: false, x: 0, y: 0, largura: 100, altura: 100, colunas: 10, linhas: 10 } },
      log: [],
      rollsLog: [],
      config: { basePV: 20 },
    });
    useStore.getState().importarJSON(json);
    const fichas = useStore.getState().fichas;
    expect(fichas[0].surtosAtivos).toEqual([]);
    expect(fichas[0].pericias).toEqual({});
    expect(fichas[0].traumas).toEqual([]);
  });

  it('normaliza tokens sem x/y (default 0.5)', () => {
    const tokenAntigo = { id: 't1', participanteId: 'f1', tipo: 'pc' as const };
    const json = JSON.stringify({
      schemaVersion: 10,
      sessaoPublica: { nomeDaMesa: 'Teste', numeroSessao: 1, clima: 'garoa', hora: '20:00', cenaAtual: 'cena 1', caso: '', localAtual: '', objetivo: '', progresso: { atual: 0, total: 0 }, atmosfera: '', contadorCena: 1, modoCombate: false, indiceAtualTurno: 0, rodada: 1, condicoesCombate: {} },
      sessaoPrivada: { oQueRealmenteAcontece: '', proximoEvento: '', lembretes: [], eventos: [], tensao: 0, ruidoNarrativo: 0, ameaca: 0, estatisticas: { rolagens: 0, surtos: 0, mortes: 0, iniciadaEm: null }, dificuldadeCena: 'media', dificuldadeCenaCustom: 15, selecionadosIniciativa: [] },
      fichas: [{ id: 'f1', corVisual: '#4fc1d4', nome: 'Teste', jogador: '', antecedenteId: null, motivo: '', perguntaQueTeDefine: '', respostaPergunta: '', gancho: '', vinculos: [], atributos: { vigor: 2, agilidade: 1, intelecto: 1, percepcao: 1, presenca: 1, vontade: 1 }, pvAtual: 20, sanidadeAtual: 10, equipamentoModificadorDefesa: 0, determinacao: 1, pericias: {}, traumas: [], kitAntecedente: '', contatoOuRecurso: '', contatoUsadoNesteCaso: false, outrosItens: '', armas: [], reguladores: [], acessos: 0, anestesiaAte: null, dinheiroReal: 500, dinheiroPonto: 800, anotacoes: '', surtosAtivos: [] }],
      fichaAtivaId: null,
      npcs: [],
      iniciativa: [],
      mapa: { imagemDataUrl: null, tokens: [tokenAntigo], grade: { ativa: false, x: 0, y: 0, largura: 100, altura: 100, colunas: 10, linhas: 10 } },
      log: [],
      rollsLog: [],
      config: { basePV: 20 },
    });
    useStore.getState().importarJSON(json);
    const tokens = useStore.getState().mapa.tokens;
    expect(tokens[0].x).toBe(0.5);
    expect(tokens[0].y).toBe(0.5);
  });

  it('lança erro em JSON inválido', () => {
    expect(() => useStore.getState().importarJSON('{ invalid json }')).toThrow('JSON inválido');
  });

  it('lança erro se não for objeto', () => {
    expect(() => useStore.getState().importarJSON('"string"')).toThrow('JSON não é um objeto');
  });

  it('lança erro se faltar campo obrigatório', () => {
    const json = JSON.stringify({ fichas: [], npcs: [], log: [], config: {} }); // falta mapa, iniciativa
    expect(() => useStore.getState().importarJSON(json)).toThrow('Campo obrigatório ausente: mapa');
  });

  it('roundtrip: exporta -> importa mantém dados', () => {
    useStore.getState().resetarEstado();
    useStore.getState().adicionarFicha();
    const fichaId = useStore.getState().fichas[0].id;
    useStore.getState().atualizarFicha(fichaId, { nome: 'Teste Roundtrip', atributos: { vigor: 3, agilidade: 2, intelecto: 1, percepcao: 1, presenca: 1, vontade: 2 } });
    useStore.getState().adicionarNpc();
    const npcId = useStore.getState().npcs[0].id;
    useStore.getState().atualizarNpc(npcId, { nome: 'NPC Roundtrip', acoes: [{ id: 'a1', nome: 'Ataque', bonus: 3, dano: '1d6' }] });
    useStore.getState().avancarCena(); // contadorCena = 2
    const exported = useStore.getState().exportarJSON();
    useStore.getState().resetarEstado();
    useStore.getState().importarJSON(exported);
    const state = useStore.getState();
    expect(state.fichas[0].nome).toBe('Teste Roundtrip');
    expect(state.fichas[0].atributos.vigor).toBe(3);
    expect(state.npcs[0].nome).toBe('NPC Roundtrip');
    expect(state.npcs[0].acoes).toHaveLength(1);
    expect(state.sessaoPublica.contadorCena).toBe(2);
    expect(state.npcs[0].acoes[0].bonus).toBe(3);
  });
});

// ===== avancarCena + surtos =====
describe('avancarCena + surtos', () => {
  beforeEach(() => {
    useStore.setState(criarEstadoInicial());
  });

  it('remove surto com expiraEm === novaCena', () => {
    const ficha = criarFichaVazia();
    ficha.surtosAtivos = [{ id: 's1', expiraEm: 2, escolha: 'Fuga cega' }, { id: 's2', expiraEm: 3, escolha: 'Fúria' }];
    useStore.setState({ fichas: [ficha], sessaoPublica: { ...useStore.getState().sessaoPublica, contadorCena: 1 } });
    useStore.getState().avancarCena(); // 1 -> 2
    const fichas = useStore.getState().fichas;
    expect(fichas[0].surtosAtivos).toHaveLength(1);
    expect(fichas[0].surtosAtivos[0].id).toBe('s2');
  });

  it('mantém surtos com expiraEm > novaCena', () => {
    const ficha = criarFichaVazia();
    ficha.surtosAtivos = [{ id: 's1', expiraEm: 5, escolha: 'Fúria' }];
    useStore.setState({ fichas: [ficha] });
    useStore.getState().avancarCena(); // 1 -> 2
    expect(useStore.getState().fichas[0].surtosAtivos).toHaveLength(1);
  });

  it('só remove surto com expiraEm === novaCena — expiraEm anterior não é limpo retroativamente', () => {
    const ficha = criarFichaVazia();
    ficha.surtosAtivos = [{ id: 's1', expiraEm: 1, escolha: 'Fuga cega' }];
    useStore.setState({ fichas: [ficha] });
    useStore.getState().avancarCena(); // 1 -> 2
    expect(useStore.getState().fichas[0].surtosAtivos).toHaveLength(1);
  });

  it('não quebra se surtosAtivos for undefined', () => {
    const ficha = criarFichaVazia();
    delete (ficha as any).surtosAtivos;
    useStore.setState({ fichas: [ficha] });
    expect(() => useStore.getState().avancarCena()).not.toThrow();
  });

  it('incrementa contadorCena', () => {
    expect(useStore.getState().sessaoPublica.contadorCena).toBe(1);
    useStore.getState().avancarCena();
    expect(useStore.getState().sessaoPublica.contadorCena).toBe(2);
    useStore.getState().avancarCena();
    expect(useStore.getState().sessaoPublica.contadorCena).toBe(3);
  });
});

// ===== converterDinheiro =====
describe('converterDinheiro', () => {
  beforeEach(() => {
    useStore.setState(criarEstadoInicial());
    useStore.getState().adicionarFicha();
  });

  describe('pontoParaReal (P$ → R$)', () => {
    it('1 P$ → 1 R$ (mínimo 1)', () => {
      useStore.getState().atualizarFicha(useStore.getState().fichas[0].id, { dinheiroPonto: 10 });
      useStore.getState().converterDinheiro(useStore.getState().fichas[0].id, 'pontoParaReal', 1);
      expect(useStore.getState().fichas[0].dinheiroPonto).toBe(9);
      expect(useStore.getState().fichas[0].dinheiroReal).toBe(501);
    });

    it('2 P$ → 1 R$ (1.4 arredonda p/ 1)', () => {
      useStore.getState().atualizarFicha(useStore.getState().fichas[0].id, { dinheiroPonto: 10 });
      useStore.getState().converterDinheiro(useStore.getState().fichas[0].id, 'pontoParaReal', 2);
      expect(useStore.getState().fichas[0].dinheiroReal).toBe(501);
    });

    it('3 P$ → 2 R$ (2.1 arredonda p/ 2)', () => {
      useStore.getState().atualizarFicha(useStore.getState().fichas[0].id, { dinheiroPonto: 10 });
      useStore.getState().converterDinheiro(useStore.getState().fichas[0].id, 'pontoParaReal', 3);
      expect(useStore.getState().fichas[0].dinheiroReal).toBe(502);
    });

    it('4 P$ → 3 R$ (2.8 arredonda p/ 3)', () => {
      useStore.getState().atualizarFicha(useStore.getState().fichas[0].id, { dinheiroPonto: 10 });
      useStore.getState().converterDinheiro(useStore.getState().fichas[0].id, 'pontoParaReal', 4);
      expect(useStore.getState().fichas[0].dinheiroReal).toBe(503);
    });

    it('5 P$ → 4 R$ (3.5 arredonda p/ 4)', () => {
      useStore.getState().atualizarFicha(useStore.getState().fichas[0].id, { dinheiroPonto: 10 });
      useStore.getState().converterDinheiro(useStore.getState().fichas[0].id, 'pontoParaReal', 5);
      expect(useStore.getState().fichas[0].dinheiroReal).toBe(504);
    });

    it('não converte se P$ insuficiente', () => {
      useStore.getState().atualizarFicha(useStore.getState().fichas[0].id, { dinheiroPonto: 0 });
      useStore.getState().converterDinheiro(useStore.getState().fichas[0].id, 'pontoParaReal', 10);
      expect(useStore.getState().fichas[0].dinheiroPonto).toBe(0);
      expect(useStore.getState().fichas[0].dinheiroReal).toBe(500);
    });
  });

  describe('realParaPonto (R$ → P$)', () => {
    it('1:1 sem taxa', () => {
      useStore.getState().atualizarFicha(useStore.getState().fichas[0].id, { dinheiroReal: 100 });
      useStore.getState().converterDinheiro(useStore.getState().fichas[0].id, 'realParaPonto', 10);
      expect(useStore.getState().fichas[0].dinheiroReal).toBe(90);
      expect(useStore.getState().fichas[0].dinheiroPonto).toBe(810);
    });

    it('não converte se R$ insuficiente', () => {
      useStore.getState().atualizarFicha(useStore.getState().fichas[0].id, { dinheiroReal: 0 });
      useStore.getState().converterDinheiro(useStore.getState().fichas[0].id, 'realParaPonto', 10);
      expect(useStore.getState().fichas[0].dinheiroReal).toBe(0);
      expect(useStore.getState().fichas[0].dinheiroPonto).toBe(800);
    });
  });
});

describe('midia', () => {
  describe('adicionarFaixaMidia/removerFaixaMidia/moverFaixaMidia', () => {
    it('adiciona faixa com ordem incremental e retorna o id', () => {
      const id1 = useStore.getState().adicionarFaixaMidia('faixa 1', 'p1.mp3', 'https://x.test/p1.mp3');
      const id2 = useStore.getState().adicionarFaixaMidia('faixa 2', 'p2.mp3', 'https://x.test/p2.mp3');
      const faixas = useStore.getState().midia.faixas;
      expect(faixas.map((f) => f.id)).toEqual([id1, id2]);
      expect(faixas.map((f) => f.ordem)).toEqual([0, 1]);
    });

    it('remover a faixa atual limpa faixaAtualId e para o playback', () => {
      const id = useStore.getState().adicionarFaixaMidia('faixa 1', 'p1.mp3', 'https://x.test/p1.mp3');
      useStore.getState().atualizarEstadoMidia({ faixaAtualId: id, tocando: true });
      useStore.getState().removerFaixaMidia(id);
      expect(useStore.getState().midia.faixaAtualId).toBeNull();
      expect(useStore.getState().midia.tocando).toBe(false);
    });

    it('remover uma faixa que não é a atual não mexe no playback', () => {
      const idAtual = useStore.getState().adicionarFaixaMidia('atual', 'p1.mp3', 'https://x.test/p1.mp3');
      const idOutra = useStore.getState().adicionarFaixaMidia('outra', 'p2.mp3', 'https://x.test/p2.mp3');
      useStore.getState().atualizarEstadoMidia({ faixaAtualId: idAtual, tocando: true });
      useStore.getState().removerFaixaMidia(idOutra);
      expect(useStore.getState().midia.faixaAtualId).toBe(idAtual);
      expect(useStore.getState().midia.tocando).toBe(true);
    });

    it('moverFaixaMidia troca ordem com o vizinho', () => {
      const idA = useStore.getState().adicionarFaixaMidia('a', 'pa.mp3', 'https://x.test/pa.mp3');
      const idB = useStore.getState().adicionarFaixaMidia('b', 'pb.mp3', 'https://x.test/pb.mp3');
      useStore.getState().moverFaixaMidia(idB, 'cima');
      const ordenadas = [...useStore.getState().midia.faixas].sort((f1, f2) => f1.ordem - f2.ordem);
      expect(ordenadas.map((f) => f.id)).toEqual([idB, idA]);
    });

    it('moverFaixaMidia nas bordas é no-op', () => {
      const idA = useStore.getState().adicionarFaixaMidia('a', 'pa.mp3', 'https://x.test/pa.mp3');
      const antes = useStore.getState().midia.faixas;
      useStore.getState().moverFaixaMidia(idA, 'cima');
      expect(useStore.getState().midia.faixas).toBe(antes);
    });
  });

  describe('atualizarEstadoMidia', () => {
    it('aplica o patch e recarimba atualizadoEm', () => {
      const antes = useStore.getState().midia.atualizadoEm;
      useStore.getState().atualizarEstadoMidia({ tocando: true, posicaoSegundos: 12 });
      const midia = useStore.getState().midia;
      expect(midia.tocando).toBe(true);
      expect(midia.posicaoSegundos).toBe(12);
      expect(midia.atualizadoEm).not.toBe(antes);
    });
  });
});

describe('soundpad', () => {
  beforeEach(() => {
    useStore.setState(criarEstadoInicial());
  });

  it('definirSomSoundpad grava no slot pedido', () => {
    useStore.getState().definirSomSoundpad(2, 'porta', 'sfx/porta', 'https://x/porta');
    const sons = useStore.getState().soundpad.sons;
    expect(sons).toHaveLength(1);
    expect(sons[0]).toMatchObject({ slot: 2, nome: 'porta', path: 'sfx/porta' });
  });

  it('definir no mesmo slot substitui, nunca acumula', () => {
    useStore.getState().definirSomSoundpad(2, 'porta', 'sfx/porta', 'https://x/porta');
    useStore.getState().definirSomSoundpad(2, 'vidro', 'sfx/vidro', 'https://x/vidro');
    const sons = useStore.getState().soundpad.sons;
    expect(sons).toHaveLength(1);
    expect(sons[0].nome).toBe('vidro');
  });

  it('remover esvazia só o slot alvo', () => {
    useStore.getState().definirSomSoundpad(0, 'a', 'p', 'u');
    useStore.getState().definirSomSoundpad(1, 'b', 'p', 'u');
    useStore.getState().removerSomSoundpad(0);
    expect(useStore.getState().soundpad.sons.map((s) => s.slot)).toEqual([1]);
  });

  it('volume do soundpad é clampado em 0..1 e não mexe no volume da música', () => {
    const volumeMusica = useStore.getState().midia.volume;
    useStore.getState().definirVolumeSoundpad(2);
    expect(useStore.getState().soundpad.volume).toBe(1);
    useStore.getState().definirVolumeSoundpad(-1);
    expect(useStore.getState().soundpad.volume).toBe(0);
    expect(useStore.getState().midia.volume).toBe(volumeMusica);
  });

  it('cada disparo gera um carimbo novo — é o que o player usa pra não repetir o efeito', async () => {
    useStore.getState().dispararSoundpad(3);
    const primeiro = useStore.getState().soundpad.ultimoDisparo;
    expect(primeiro?.slot).toBe(3);
    await new Promise((r) => setTimeout(r, 2));
    useStore.getState().dispararSoundpad(3);
    expect(useStore.getState().soundpad.ultimoDisparo?.em).not.toBe(primeiro?.em);
  });
});

describe('rerolarIniciativaDe', () => {
  const montarIniciativa = () => {
    const npc1 = { id: 'n1', nome: 'Alvo', corVisual: '#fff', silhueta: null, foto: null, pvAtual: 10, pvMaximo: 10, defesa: 10, agilidade: 3, notas: '', visivel: false, notasMestre: '', categoria: '', acoes: [] };
    const npc2 = { id: 'n2', nome: 'Fixo', corVisual: '#fff', silhueta: null, foto: null, pvAtual: 10, pvMaximo: 10, defesa: 10, agilidade: 1, notas: '', visivel: false, notasMestre: '', categoria: '', acoes: [] };
    useStore.setState({
      npcs: [npc1, npc2],
      iniciativa: [
        { id: 'e1', participanteId: 'n1', tipo: 'npc', nome: 'Alvo', valor: 20 },
        { id: 'e2', participanteId: 'n2', tipo: 'npc', nome: 'Fixo', valor: 10 },
      ],
      sessaoPublica: { ...useStore.getState().sessaoPublica, modoCombate: true, indiceAtualTurno: 1 },
    });
  };

  it('atualiza o valor e reordena a lista', () => {
    montarIniciativa();
    vi.spyOn(Math, 'random').mockReturnValue(0); // d20 = 1
    useStore.getState().rerolarIniciativaDe('n1'); // 1 + agilidade(3) = 4, cai abaixo do Fixo (10)
    const iniciativa = useStore.getState().iniciativa;
    expect(iniciativa.map((e) => e.participanteId)).toEqual(['n2', 'n1']);
    expect(iniciativa.find((e) => e.participanteId === 'n1')?.valor).toBe(4);
    vi.restoreAllMocks();
  });

  it('mantém indiceAtualTurno grudado em quem estava na vez, mesmo com a reordenação', () => {
    montarIniciativa(); // indiceAtualTurno=1 → 'n2' (Fixo) está na vez
    vi.spyOn(Math, 'random').mockReturnValue(0); // d20 = 1 → n1 cai pra depois de n2
    useStore.getState().rerolarIniciativaDe('n1');
    const s = useStore.getState();
    expect(s.iniciativa[s.sessaoPublica.indiceAtualTurno].participanteId).toBe('n2');
    vi.restoreAllMocks();
  });

  it('participanteId fora da iniciativa não faz nada', () => {
    montarIniciativa();
    const antes = useStore.getState().iniciativa;
    useStore.getState().rerolarIniciativaDe('nao-existe');
    expect(useStore.getState().iniciativa).toBe(antes);
  });
});

describe('rolarIniciativaGrupo', () => {
  const criarNpc = (id: string, nome: string, agilidade: number) => ({
    id, nome, corVisual: '#fff', silhueta: null, foto: null, pvAtual: 10, pvMaximo: 10, defesa: 10, agilidade,
    notas: '', visivel: false, notasMestre: '', categoria: '', acoes: [],
  });

  it('todos os NPCs do grupo recebem o mesmo valor — d20 + a MAIOR agilidade entre eles', () => {
    const npcs = [criarNpc('p1', 'Pol1', 2), criarNpc('p2', 'Pol2', 4), criarNpc('p3', 'Pol3', 1)];
    useStore.setState({ npcs, iniciativa: [] });
    vi.spyOn(Math, 'random').mockReturnValue(0); // d20 = 1
    useStore.getState().rolarIniciativaGrupo(['p1', 'p2', 'p3']);
    const iniciativa = useStore.getState().iniciativa;
    expect(iniciativa).toHaveLength(3);
    expect(iniciativa.every((e) => e.valor === 5)).toBe(true); // 1 + maior agilidade (4)
    expect(iniciativa.every((e) => e.tipo === 'npc')).toBe(true);
    vi.restoreAllMocks();
  });

  it('registra uma entrada de log só, com os nomes do grupo', () => {
    const npcs = [criarNpc('p1', 'Pol1', 2), criarNpc('p2', 'Pol2', 3)];
    useStore.setState({ npcs, iniciativa: [], log: [] });
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    useStore.getState().rolarIniciativaGrupo(['p1', 'p2']);
    const log = useStore.getState().log;
    expect(log).toHaveLength(1);
    expect(log[0].texto).toContain('Pol1');
    expect(log[0].texto).toContain('Pol2');
    vi.restoreAllMocks();
  });

  it('ids que não batem com nenhum NPC não fazem nada', () => {
    useStore.setState({ npcs: [], iniciativa: [] });
    const antes = useStore.getState().iniciativa;
    useStore.getState().rolarIniciativaGrupo(['nao-existe']);
    expect(useStore.getState().iniciativa).toBe(antes);
  });

  it('não mexe em entradas de iniciativa já existentes de outros participantes', () => {
    const npcs = [criarNpc('p1', 'Pol1', 2), criarNpc('p2', 'Pol2', 3)];
    useStore.setState({
      npcs,
      iniciativa: [{ id: 'e0', participanteId: 'outro', tipo: 'npc', nome: 'Outro', valor: 99 }],
    });
    useStore.getState().rolarIniciativaGrupo(['p1', 'p2']);
    const iniciativa = useStore.getState().iniciativa;
    expect(iniciativa.find((e) => e.participanteId === 'outro')?.valor).toBe(99);
    expect(iniciativa).toHaveLength(3);
  });
});

// Combatente adicionado NO MEIO de um combate: antes ele era sempre anexado no fim da
// lista, ignorando o valor rolado (a lista é posicional — `avancarTurno` usa o índice).
describe('adicionar combatente com combate em andamento', () => {
  const criarNpc = (id: string, nome: string, agilidade: number) => ({
    id, nome, corVisual: '#fff', silhueta: null, foto: null, pvAtual: 10, pvMaximo: 10, defesa: 10, agilidade,
    notas: '', visivel: false, notasMestre: '', categoria: '', acoes: [],
  });
  // lista em combate: valores 20 / 12 / 5
  const iniciativaBase = [
    { id: 'e1', participanteId: 'a', tipo: 'npc' as const, nome: 'A', valor: 20 },
    { id: 'e2', participanteId: 'b', tipo: 'npc' as const, nome: 'B', valor: 12 },
    { id: 'e3', participanteId: 'c', tipo: 'npc' as const, nome: 'C', valor: 5 },
  ];

  const prepararCombate = (agilidadeDoNovo: number, indiceAtualTurno: number) => {
    useStore.setState((s) => ({
      npcs: [criarNpc('novo', 'Novo', agilidadeDoNovo)],
      iniciativa: iniciativaBase.map((e) => ({ ...e })),
      sessaoPublica: { ...s.sessaoPublica, modoCombate: true, indiceAtualTurno },
    }));
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // d20 = 11
  };

  it('entra na posição do valor rolado, não no fim da lista', () => {
    prepararCombate(0, 0); // 11 + 0 = 11 → entre B (12) e C (5)
    useStore.getState().rolarIniciativa(['novo']);
    expect(useStore.getState().iniciativa.map((e) => e.participanteId)).toEqual(['a', 'b', 'novo', 'c']);
    vi.restoreAllMocks();
  });

  it('inserir DEPOIS do turno atual não move a seta de turno', () => {
    prepararCombate(0, 1); // B está na vez; novo (11) entra depois dele
    useStore.getState().rolarIniciativa(['novo']);
    const s = useStore.getState();
    expect(s.sessaoPublica.indiceAtualTurno).toBe(1);
    expect(s.iniciativa[s.sessaoPublica.indiceAtualTurno].participanteId).toBe('b');
    vi.restoreAllMocks();
  });

  it('inserir ANTES do turno atual empurra o índice — a vez continua da mesma pessoa', () => {
    prepararCombate(4, 2); // C está na vez; novo (11+4=15) entra antes, entre A e B
    useStore.getState().rolarIniciativa(['novo']);
    const s = useStore.getState();
    expect(s.iniciativa.map((e) => e.participanteId)).toEqual(['a', 'novo', 'b', 'c']);
    expect(s.sessaoPublica.indiceAtualTurno).toBe(3);
    expect(s.iniciativa[s.sessaoPublica.indiceAtualTurno].participanteId).toBe('c');
    vi.restoreAllMocks();
  });

  it('rolagem em grupo também respeita a posição e mantém o grupo adjacente', () => {
    useStore.setState((s) => ({
      npcs: [criarNpc('g1', 'G1', 4), criarNpc('g2', 'G2', 2)],
      iniciativa: iniciativaBase.map((e) => ({ ...e })),
      sessaoPublica: { ...s.sessaoPublica, modoCombate: true, indiceAtualTurno: 2 },
    }));
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // d20 = 11 → 11 + maior agilidade (4) = 15
    useStore.getState().rolarIniciativaGrupo(['g1', 'g2']);
    const s = useStore.getState();
    expect(s.iniciativa.map((e) => e.participanteId)).toEqual(['a', 'g1', 'g2', 'b', 'c']);
    expect(s.iniciativa[s.sessaoPublica.indiceAtualTurno].participanteId).toBe('c');
    vi.restoreAllMocks();
  });
});

// ===== migrate (schema versionado do persist) =====
// Caminho DIFERENTE de importarJSON (acima) — migrate só roda na reidratação do
// localStorage pelo zustand/persist. Cobre as migrações mais recentes/arriscadas, não as
// 23 versões uma por uma.
describe('migrate', () => {
  it('v1 → v2: injeta grade default quando mapa não tem grade', () => {
    const estado = migrate({ mapa: { imagemDataUrl: null, tokens: [] } }, 1);
    expect(estado.mapa.grade).toEqual(criarGradeInicial());
  });

  it('v1 → v2: não mexe em mapa que já tem grade', () => {
    const gradeCustom = { ...criarGradeInicial(), colunas: 20 };
    const estado = migrate({ mapa: { imagemDataUrl: null, tokens: [], grade: gradeCustom } }, 1);
    expect(estado.mapa.grade).toEqual(gradeCustom);
  });

  it('v10 → v11: converte surtoAtivo/surtoEscolha soltos em surtosAtivos', () => {
    const estado = migrate(
      { fichas: [{ id: 'f1', nome: 'Helena', surtoAtivo: 5, surtoEscolha: 'Fuga cega' }] },
      10,
    );
    expect(estado.fichas[0].surtosAtivos).toHaveLength(1);
    expect(estado.fichas[0].surtosAtivos[0]).toMatchObject({ expiraEm: 5, escolha: 'Fuga cega' });
    expect(estado.fichas[0]).not.toHaveProperty('surtoAtivo');
    expect(estado.fichas[0]).not.toHaveProperty('surtoEscolha');
  });

  it('v10 → v11: ficha sem surto ativo (surtoAtivo null) vira array vazio', () => {
    const estado = migrate({ fichas: [{ id: 'f1', nome: 'Pedro', surtoAtivo: null, surtoEscolha: null }] }, 10);
    expect(estado.fichas[0].surtosAtivos).toEqual([]);
  });

  it('v21 → v22: injeta foto null em fichas e silhueta null em npcs', () => {
    const estado = migrate(
      { fichas: [{ id: 'f1', nome: 'Helena' }], npcs: [{ id: 'n1', nome: 'Guarda' }] },
      21,
    );
    expect(estado.fichas[0].foto).toBeNull();
    expect(estado.npcs[0].silhueta).toBeNull();
  });

  it('v22 → v23: injeta foto null em npcs existentes', () => {
    const estado = migrate({ npcs: [{ id: 'n1', nome: 'Guarda', silhueta: 'guarda' }] }, 22);
    expect(estado.npcs[0].foto).toBeNull();
    expect(estado.npcs[0].silhueta).toBe('guarda');
  });

  it('estado já na versão atual passa sem alterações inesperadas', () => {
    const fichaAtual = { id: 'f1', nome: 'Helena', foto: 'data:image/jpeg;base64,x', surtosAtivos: [] };
    const estado = migrate({ fichas: [fichaAtual], npcs: [] }, 23);
    expect(estado.fichas[0]).toEqual(fichaAtual);
  });

  it('v23 → v24: injeta pistas vazio quando ausente', () => {
    const estado = migrate({ npcs: [] }, 23);
    expect(estado.pistas).toEqual([]);
  });

  it('v24 → v25: injeta soundpad default quando ausente', () => {
    const estado = migrate({ npcs: [] }, 24);
    expect(estado.soundpad).toEqual({ sons: [], volume: 0.8, ultimoDisparo: null });
  });
});

describe('adicionarPista/atualizarPista/removerPista', () => {
  beforeEach(() => {
    useStore.setState(criarEstadoInicial());
  });

  it('adiciona uma pista vazia em "não descoberta" e permite editar e mover status', () => {
    const id = useStore.getState().adicionarPista();
    const pista = useStore.getState().pistas.find((p) => p.id === id);
    expect(pista?.status).toBe('nao-descoberta');
    expect(pista?.texto).toBe('');

    useStore.getState().atualizarPista(id, { texto: 'sangue no elevador', status: 'descoberta' });
    const atualizada = useStore.getState().pistas.find((p) => p.id === id);
    expect(atualizada?.texto).toBe('sangue no elevador');
    expect(atualizada?.status).toBe('descoberta');

    useStore.getState().removerPista(id);
    expect(useStore.getState().pistas.find((p) => p.id === id)).toBeUndefined();
  });
});

// QuotaExceededError (mapa/mídia grandes) ou localStorage indisponível (Safari privado)
// lançavam não capturados de dentro do setTimeout do debounce — a mesa parava de salvar em
// silêncio. `criarStorageComDebounce` precisa engolir isso e avisar via lib/statusMesa.
describe('criarStorageComDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useStatusMesa.setState({ local: 'ok', canaisConectados: new Set(), canaisComErro: new Set() });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const criarStorageFalso = (comportamento: { lancaNoSet?: boolean; lancaNoGet?: boolean } = {}) => {
    const dados = new Map<string, string>();
    return {
      getItem: vi.fn((chave: string) => {
        if (comportamento.lancaNoGet) throw new DOMException('SecurityError');
        return dados.get(chave) ?? null;
      }),
      setItem: vi.fn((chave: string, valor: string) => {
        if (comportamento.lancaNoSet) throw new DOMException('QuotaExceededError');
        dados.set(chave, valor);
      }),
      removeItem: vi.fn((chave: string) => {
        dados.delete(chave);
      }),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    } as Storage;
  };

  it('grava depois do atraso do debounce e marca status local ok', () => {
    const bruto = criarStorageFalso();
    const storage = criarStorageComDebounce(bruto);
    storage.setItem('estatica-mesa', '{"a":1}');
    expect(bruto.setItem).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);
    expect(bruto.setItem).toHaveBeenCalledWith('estatica-mesa', '{"a":1}');
    expect(useStatusMesa.getState().local).toBe('ok');
  });

  it('setItem que lança (quota estourada) não propaga e marca status local erro', () => {
    const bruto = criarStorageFalso({ lancaNoSet: true });
    const storage = criarStorageComDebounce(bruto);
    storage.setItem('estatica-mesa', '{"a":1}');
    expect(() => vi.advanceTimersByTime(400)).not.toThrow();
    expect(useStatusMesa.getState().local).toBe('erro');
  });

  it('getItem que lança (Safari privado) devolve null em vez de derrubar a app', () => {
    const bruto = criarStorageFalso({ lancaNoGet: true });
    const storage = criarStorageComDebounce(bruto);
    expect(() => storage.getItem('estatica-mesa')).not.toThrow();
    expect(storage.getItem('estatica-mesa')).toBeNull();
  });

  it('escritas repetidas antes do atraso só gravam a última versão', () => {
    const bruto = criarStorageFalso();
    const storage = criarStorageComDebounce(bruto);
    storage.setItem('estatica-mesa', 'v1');
    storage.setItem('estatica-mesa', 'v2');
    storage.setItem('estatica-mesa', 'v3');
    vi.advanceTimersByTime(400);
    expect(bruto.setItem).toHaveBeenCalledTimes(1);
    expect(bruto.setItem).toHaveBeenCalledWith('estatica-mesa', 'v3');
  });
});