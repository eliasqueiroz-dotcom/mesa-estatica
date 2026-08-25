import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarEstadoInicial } from '../state/factories';
import { useStore } from '../state/store';
import type { EntradaIniciativa } from '../state/types';
import { retomarPendenciasPersistidas } from './filaPendencias';
import { paraEntrada, paraLinha } from './iniciativaSync';

const criarStorageFalso = () => {
  const dados = new Map<string, string>();
  return {
    getItem: (chave: string) => dados.get(chave) ?? null,
    setItem: (chave: string, valor: string) => {
      dados.set(chave, valor);
    },
  };
};

describe('paraLinha / paraEntrada', () => {
  it('round-trip preserva os campos da entrada de iniciativa', () => {
    const entrada: EntradaIniciativa = { id: 'e1', participanteId: 'pc-1', tipo: 'pc', nome: 'Helena', valor: 17 };
    const linha = paraLinha(entrada, 2);
    expect(linha).toEqual({
      id: 'e1', participante_id: 'pc-1', tipo: 'pc', nome: 'Helena', valor: 17, posicao: 2,
      d20: null, agilidade: null,
    });

    const reconstruida = paraEntrada(linha);
    expect(reconstruida).toEqual(entrada);
  });

  it('preserva o tipo npc', () => {
    const entrada: EntradaIniciativa = { id: 'e2', participanteId: 'npc-1', tipo: 'npc', nome: 'Guarda', valor: 9 };
    const linha = paraLinha(entrada, 0);
    expect(paraEntrada(linha).tipo).toBe('npc');
  });

  it('round-trip preserva d20/agilidade — sem isso o tooltip "rolagem iniciativa" perde o detalhe depois de sincronizar', () => {
    const entrada: EntradaIniciativa = { id: 'e3', participanteId: 'pc-2', tipo: 'pc', nome: 'Marco', valor: 15, d20: 12, agilidade: 3 };
    const linha = paraLinha(entrada, 1);
    expect(linha.d20).toBe(12);
    expect(linha.agilidade).toBe(3);

    const reconstruida = paraEntrada(linha);
    expect(reconstruida).toEqual(entrada);
  });

  it('linha sem d20/agilidade (dado salvo antes da migração 0033) reconstrói sem esses campos, não como null', () => {
    const linhaAntiga = { id: 'e4', participante_id: 'pc-3', tipo: 'pc' as const, nome: 'Ana', valor: 14, posicao: 0, d20: null, agilidade: null };
    const entrada = paraEntrada(linhaAntiga);
    expect(entrada.d20).toBeUndefined();
    expect(entrada.agilidade).toBeUndefined();
  });
});

// ===== busca inicial (iniciarSyncIniciativa) =====
const h = vi.hoisted(() => ({ clienteAtual: null as unknown }));
vi.mock('../lib/supabaseClient', () => ({
  get supabase() {
    return h.clienteAtual;
  },
}));
vi.mock('../lib/statusMesa', () => ({
  assinarStatusCanal: vi.fn(() => vi.fn()),
  assinarStatusCanalComRefetch: vi.fn((_nome: string, refetch: () => void | Promise<void>) => {
    let viuErro = false;
    return (status: string) => {
      if (status === 'SUBSCRIBED') {
        if (viuErro) void refetch();
        viuErro = false;
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        viuErro = true;
      }
    };
  }),
  desconectarCanal: vi.fn(),
  useStatusMesa: {
    getState: vi.fn(() => ({ canaisConectados: new Set(), canaisComErro: new Set() })),
    setState: vi.fn(),
    subscribe: vi.fn(),
  },
}));

const { iniciarSyncIniciativa } = await import('./iniciativaSync');

function criarClienteComControle() {
  const resolvers: Array<(data: unknown) => void> = [];
  let statusCb: ((status: string) => void) | undefined;

  function criarBuilder(): any {
    const builder: any = {};
    builder.select = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.then = (onFulfilled: (result: { data: unknown; error: null }) => void) => {
      return new Promise((resolve) => {
        resolvers.push((data: unknown) => resolve(onFulfilled({ data, error: null })));
      });
    };
    builder.upsert = vi.fn(() => Promise.resolve({ error: null }));
    builder.delete = vi.fn(() => ({
      in: vi.fn(() => ({
        then: (cb: (r: unknown) => void) => cb({ error: null }),
      })),
    }));
    return builder;
  }

  const from = vi.fn(() => criarBuilder());

  const channelObj: any = {};
  channelObj.on = vi.fn(() => channelObj);
  channelObj.subscribe = vi.fn((cb: (status: string) => void) => {
    statusCb = cb;
    cb('SUBSCRIBED');
    return channelObj;
  });
  const channel = vi.fn(() => channelObj);
  const removeChannel = vi.fn();

  return { from, channel, removeChannel, resolvers, get statusCb() { return statusCb; } };
}

function linhaRemota(id: string, participanteId: string, posicao: number) {
  return { id, participante_id: participanteId, tipo: 'pc' as const, nome: 'Helena', valor: 17, posicao, d20: 13, agilidade: 4 };
}

describe('iniciarSyncIniciativa — busca inicial', () => {
  let mock: ReturnType<typeof criarClienteComControle>;
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    useStore.setState(criarEstadoInicial());
    mock = criarClienteComControle();
    h.clienteAtual = { from: mock.from, channel: mock.channel, removeChannel: mock.removeChannel };
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    h.clienteAtual = null;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('popula a iniciativa local a partir do Supabase quando ela está vazia (reload em combate)', async () => {
    cleanup = iniciarSyncIniciativa();

    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(1));
    mock.resolvers[0]([linhaRemota('e1', 'pc-1', 0), linhaRemota('e2', 'pc-2', 1)]);

    await vi.waitFor(() => {
      expect(useStore.getState().iniciativa).toHaveLength(2);
    });
    expect(useStore.getState().iniciativa.map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('não sobrescreve iniciativa local se o mestre já rolou antes da resposta do Supabase chegar', async () => {
    cleanup = iniciarSyncIniciativa();

    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(1));

    // edição local ANTES do fetch resolver (mestre rolou de novo enquanto a busca inicial estava em voo)
    useStore.setState({
      iniciativa: [{ id: 'local-1', participanteId: 'pc-3', tipo: 'pc', nome: 'Local', valor: 5 }],
    });

    mock.resolvers[0]([linhaRemota('e1', 'pc-1', 0)]);

    // dá tempo do .then() da busca inicial rodar, se fosse aplicar
    await new Promise((r) => setTimeout(r, 0));

    expect(useStore.getState().iniciativa).toHaveLength(1);
    expect(useStore.getState().iniciativa[0].id).toBe('local-1');
  });

  it('sem linhas no Supabase (mesa nunca sincronizada) não mexe na iniciativa local', async () => {
    cleanup = iniciarSyncIniciativa();

    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(1));
    mock.resolvers[0]([]);

    await new Promise((r) => setTimeout(r, 0));
    expect(useStore.getState().iniciativa).toEqual([]);
  });

  it('marca "em voo" (chave fixa "iniciativa") no momento em que agenda o push — antes do debounce disparar', () => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', criarStorageFalso());

    cleanup = iniciarSyncIniciativa();
    useStore.setState({ iniciativa: [{ id: 'e1', participanteId: 'pc-1', tipo: 'pc', nome: 'Helena', valor: 17 }] });

    // o timer do debounce nem chegou a disparar (fake timers, nunca avançados) — se a marca já
    // existe aqui, uma aba fechada NESSE exato meio-tempo não perde a ordem de turno (achado de
    // 23/08). Diferente dos outros módulos, a busca inicial daqui só incrementa
    // `aplicandoRemotoContagem` DEPOIS do `.then()` resolver — não precisa liberar nada antes.
    expect(retomarPendenciasPersistidas('iniciativa-sync')).toContain('iniciativa');
  });

  it('canal cai e reconecta busca a ordem atual MESMO com combate já em andamento (busca inicial sozinha é no-op nesse caso)', async () => {
    cleanup = iniciarSyncIniciativa();

    // busca inicial: combate já em andamento localmente antes de qualquer resposta chegar
    useStore.setState({
      iniciativa: [{ id: 'local-1', participanteId: 'pc-3', tipo: 'pc', nome: 'Local', valor: 5 }],
    });
    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(1));
    mock.resolvers[0]([]); // não aplica (iniciativa local não está vazia) — comportamento existente

    // canal cai e reconecta — o mestre reordenou/rolou iniciativa em outra aba enquanto este
    // cliente estava desconectado, sem nenhum evento `postgres_changes` chegar aqui
    mock.statusCb?.('CHANNEL_ERROR');
    mock.statusCb?.('SUBSCRIBED');

    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(2));
    mock.resolvers[1]([linhaRemota('e1', 'pc-1', 0), linhaRemota('e2', 'pc-2', 1)]);

    await vi.waitFor(() => {
      expect(useStore.getState().iniciativa.map((e) => e.id)).toEqual(['e1', 'e2']);
    });
  });

  it('refetch de reconexão não sobrescreve edição local concorrente feita durante o fetch', async () => {
    cleanup = iniciarSyncIniciativa();

    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(1));
    mock.resolvers[0]([]);

    mock.statusCb?.('CHANNEL_ERROR');
    mock.statusCb?.('SUBSCRIBED');
    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(2));

    // edita localmente ANTES do fetch de reconexão resolver
    useStore.setState({
      iniciativa: [{ id: 'editado-durante-fetch', participanteId: 'pc-9', tipo: 'pc', nome: 'Editado', valor: 20 }],
    });

    mock.resolvers[1]([linhaRemota('e1', 'pc-1', 0)]); // dado remoto desatualizado

    await new Promise((r) => setTimeout(r, 0));
    expect(useStore.getState().iniciativa.map((e) => e.id)).toEqual(['editado-durante-fetch']);
  });
});
