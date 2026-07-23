import { describe, expect, it, beforeEach, vi } from 'vitest';
import { useStore } from './store';
import { calcularSanidadeMaxima } from '../rules/derivados';
import { criarEstadoInicial, criarFichaVazia } from './factories';
import { TABELA_SURTO } from '../rules/data/surto';

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
    useStore.getState().ajustarSanidadeAtual(id, 4);
    expect(useStore.getState().escolhasSurtoPendentes[id]).toBeDefined();
  });

  it('cria entrada com escolha pendente quando d20 diferem', () => {
    const id = adicionarFicha(10);
    useStore.getState().ajustarSanidadeAtual(id, 4);
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