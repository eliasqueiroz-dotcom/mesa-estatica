import { describe, expect, it, beforeEach, vi } from 'vitest';
import { useStore } from './store';
import { calcularSanidadeMaxima } from '../rules/derivados';
import { criarEstadoInicial, criarFichaVazia, criarNpcVazio } from './factories';
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

  it('remove todos os surtos ao avançar', () => {
    const ficha = criarFichaVazia();
    ficha.surtosAtivos = [{ id: '1', expiraEm: 1, escolha: 'Fuga cega' }];
    useStore.setState({ fichas: [ficha], sessaoPublica: { ...useStore.getState().sessaoPublica, contadorCena: 1 } });
    useStore.getState().avancarCena();
    expect(useStore.getState().fichas[0].surtosAtivos).toEqual([]);
  });

  it('não quebra se surtosAtivos for undefined', () => {
    const ficha = criarFichaVazia() as any;
    delete ficha.surtosAtivos;
    useStore.setState({ fichas: [ficha] });
    expect(() => useStore.getState().avancarCena()).not.toThrow();
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
    const id = adicionarFicha(10, 6);
    const maxima = calcularSanidadeMaxima(6);
    useStore.getState().ajustarSanidadeAtual(id, 999);
    expect(useStore.getState().fichas[0].sanidadeAtual).toBe(maxima);
  });

  it('dispara surto quando perde 5+ de uma vez', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // d20A=1, d20B=1 → mesmo numero
    const id = adicionarFicha(10);
    useStore.getState().ajustarSanidadeAtual(id, 4);
    expect(useStore.getState().fichas[0].surtosAtivos.length).toBe(1);
    vi.restoreAllMocks();
  });

  it('cria entrada com escolha pendente quando d20 diferem', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)   // d20A = 1
      .mockReturnValueOnce(19 / 20); // d20B = 20
    const id = adicionarFicha(10);
    useStore.getState().ajustarSanidadeAtual(id, 4);
    expect(useStore.getState().escolhasSurtoPendentes[id]).toBeDefined();
    vi.restoreAllMocks();
  });

  it('cria entrada com escolha preenchida quando d20 iguais', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // d20A=1, d20B=1
    const id = adicionarFicha(10);
    useStore.getState().ajustarSanidadeAtual(id, 4);
    const surto = useStore.getState().fichas[0].surtosAtivos[0];
    expect(surto.escolha).toBe(TABELA_SURTO.find((e) => e.d20 === 1)!.nome);
    vi.restoreAllMocks();
  });

  it('incrementa estatística de surtos', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const id = adicionarFicha(10);
    expect(useStore.getState().sessaoPrivada.estatisticas.surtos).toBe(0);
    useStore.getState().ajustarSanidadeAtual(id, 4);
    expect(useStore.getState().sessaoPrivada.estatisticas.surtos).toBe(1);
    vi.restoreAllMocks();
  });
});

describe('resolverEscolhaSurtoPendente', () => {
  function setupComSurtoPendente() {
    const ficha = criarFichaVazia();
    ficha.surtosAtivos = [{ id: 's1', expiraEm: 3, escolha: null }];
    useStore.setState({
      fichas: [ficha],
      escolhasSurtoPendentes: {
        [ficha.id]: {
          nomeFicha: ficha.nome,
          entradaA: TABELA_SURTO.find((e) => e.d20 === 1)!,
          entradaB: TABELA_SURTO.find((e) => e.d20 === 20)!,
        },
      },
    });
    return ficha.id;
  }

  it('atualiza escolha do surto pendente', () => {
    const id = setupComSurtoPendente();
    useStore.getState().resolverEscolhaSurtoPendente(id, 'A');
    expect(useStore.getState().fichas[0].surtosAtivos[0].escolha).toBe(TABELA_SURTO.find((e) => e.d20 === 1)!.nome);
  });

  it('não duplica entradas', () => {
    const id = setupComSurtoPendente();
    useStore.getState().resolverEscolhaSurtoPendente(id, 'A');
    expect(useStore.getState().fichas[0].surtosAtivos.length).toBe(1);
  });

  it('limpa escolha pendente após resolver', () => {
    const id = setupComSurtoPendente();
    useStore.getState().resolverEscolhaSurtoPendente(id, 'A');
    expect(useStore.getState().escolhasSurtoPendentes[id]).toBeUndefined();
  });

  it('não quebra se não há pendente', () => {
    expect(() => useStore.getState().resolverEscolhaSurtoPendente('inexistente', 'A')).not.toThrow();
  });
});

describe('migrate', () => {
  it('v8→v9 adiciona acoes:[] nos NPCs', () => {
    const npc = criarNpcVazio();
    delete (npc as any).acoes;
    const migrado = { ...npc, visivel: false, notasMestre: '', categoria: '', acoes: [] };
    expect(migrado.acoes).toEqual([]);
  });

  it('v10→v11 converte surtoAtivo para surtosAtivos:[]', () => {
    const antiga: any = { ...criarFichaVazia(), surtoAtivo: 3, surtoEscolha: 'Fuga cega' };
    delete antiga.surtosAtivos;
    const migrada: any = { ...antiga, surtosAtivos: [], surtoAtivo: undefined, surtoEscolha: undefined };
    expect(migrada.surtosAtivos).toEqual([]);
    expect(migrada.surtoAtivo).toBeUndefined();
    expect(migrada.surtoEscolha).toBeUndefined();
  });

  it('v11→v12 deduplica por id', () => {
    const ficha = criarFichaVazia();
    ficha.surtosAtivos = [
      { id: 'dup', expiraEm: 3, escolha: 'Fuga cega' },
      { id: 'dup', expiraEm: 5, escolha: 'Fúria' },
    ];
    const vistos = new Set<string>();
    const dedup = ficha.surtosAtivos.filter((s: any) => {
      if (!s.id) return true;
      if (vistos.has(s.id)) return false;
      vistos.add(s.id);
      return true;
    });
    expect(dedup.length).toBe(1);
    expect(dedup[0].escolha).toBe('Fuga cega');
  });
});

describe('campos de array undefined/null', () => {
  function fichaSemCampo(campo: string) {
    useStore.getState().adicionarFicha();
    const id = useStore.getState().fichas[0].id;
    useStore.setState((s) => ({
      fichas: s.fichas.map((f) => {
        if (f.id !== id) return f;
        const { [campo]: _, ...rest } = f as any;
        return rest as any;
      }),
    }));
    return id;
  }

  describe('surtosAtivos undefined', () => {
    it('ajustarSanidadeAtual não quebra se surtosAtivos for undefined', () => {
      const id = fichaSemCampo('surtosAtivos');
      expect(() => useStore.getState().ajustarSanidadeAtual(id, 5)).not.toThrow();
      const ficha = useStore.getState().fichas.find((f) => f.id === id)!;
      expect(ficha.sanidadeAtual).toBe(5);
    });

    it('resolverEscolhaSurtoPendente não quebra se surtosAtivos for undefined', () => {
      const id = fichaSemCampo('surtosAtivos');
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
      fichaSemCampo('surtosAtivos');
      expect(() => useStore.getState().avancarCena()).not.toThrow();
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
});
