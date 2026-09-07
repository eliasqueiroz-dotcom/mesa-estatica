import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarEstadoInicial } from '../state/factories';
import { useStore } from '../state/store';

// ===== marcarEmVoo na janela do debounce (iniciarSyncMapaAtivo) =====
// Mesmo achado de 23/08 que motivou `marcarEmVoo` em filaPendencias.ts, aplicado ao ponteiro
// "qual mapa está ativo" (substitui o antigo mapaPublicoSync.ts, que sincronizava imagem/grid
// direto na mesma linha — agora isso é mapasBibliotecaSync.ts).
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

const { iniciarSyncMapaAtivo } = await import('./mapaAtivoSync');
const { retomarPendenciasPersistidas } = await import('./filaPendencias');

/** Cliente mínimo — só o suficiente pra `iniciarSyncMapaAtivo()` montar sem lançar. */
function criarClienteMinimo() {
  const resolvido = { data: null, error: null };
  const builder: any = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.maybeSingle = () => Promise.resolve(resolvido);
  builder.upsert = () => Promise.resolve({ error: null });

  const channelObj: any = {};
  channelObj.on = () => channelObj;
  channelObj.subscribe = (cb?: (status: string) => void) => {
    cb?.('SUBSCRIBED');
    return channelObj;
  };

  return { from: () => builder, channel: () => channelObj, removeChannel: () => {} };
}

function criarStorageFalso() {
  const dados = new Map<string, string>();
  return {
    getItem: (chave: string) => dados.get(chave) ?? null,
    setItem: (chave: string, valor: string) => {
      dados.set(chave, valor);
    },
  };
}

describe('iniciarSyncMapaAtivo — marca "em voo" antes do debounce disparar', () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    useStore.setState(criarEstadoInicial());
    h.clienteAtual = criarClienteMinimo();
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    h.clienteAtual = null;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('marca "em voo" (chave fixa "mapa") no momento em que a troca de mapa ativo dispara — não espera round-trip de rede', () => {
    vi.stubGlobal('localStorage', criarStorageFalso());

    cleanup = iniciarSyncMapaAtivo();
    useStore.getState().selecionarMapaAtivo('mapa-1');

    expect(retomarPendenciasPersistidas('mapa-ativo-sync')).toContain('mapa');
  });
});

// ===== refetch de reconexão =====
function criarClienteComControle() {
  const resolvers: Array<(data: unknown) => void> = [];
  let statusCb: ((status: string) => void) | undefined;

  const builder: any = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.maybeSingle = () => {
    return new Promise((resolve) => {
      resolvers.push((data: unknown) => resolve({ data, error: null }));
    });
  };
  builder.upsert = () => Promise.resolve({ error: null });

  const channelObj: any = {};
  channelObj.on = () => channelObj;
  channelObj.subscribe = (cb: (status: string) => void) => {
    statusCb = cb;
    cb('SUBSCRIBED');
    return channelObj;
  };

  return {
    from: () => builder,
    channel: () => channelObj,
    removeChannel: () => {},
    resolvers,
    get statusCb() {
      return statusCb;
    },
  };
}

describe('iniciarSyncMapaAtivo — refetch de reconexão', () => {
  let mock: ReturnType<typeof criarClienteComControle>;
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    useStore.setState(criarEstadoInicial());
    mock = criarClienteComControle();
    h.clienteAtual = mock;
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    h.clienteAtual = null;
    vi.restoreAllMocks();
  });

  it('canal cai e reconecta rebusca qual mapa está ativo, mesmo sem evento Realtime durante a queda', async () => {
    cleanup = iniciarSyncMapaAtivo();

    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(1));
    mock.resolvers[0](null); // busca inicial: sem linha ainda

    // canal cai e reconecta — o mestre trocou de mapa em outra aba enquanto este cliente
    // estava desconectado, sem nenhum evento `postgres_changes` chegar aqui.
    mock.statusCb?.('CHANNEL_ERROR');
    mock.statusCb?.('SUBSCRIBED');

    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(2));
    mock.resolvers[1]({ id: 'mapa', mapa_ativo_id: 'mapa-novo' });

    await vi.waitFor(() => {
      expect(useStore.getState().mapa.mapaAtivoId).toBe('mapa-novo');
    });
  });
});

// ===== eco remoto durante a janela de debounce não reverte a troca local (mesmo achado de mapaPublicoSync.ts original) =====
function criarClienteComEventoRealtime() {
  let handlerPostgresChanges: ((payload: { new: unknown }) => void) | undefined;

  const builder: any = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.maybeSingle = () => Promise.resolve({ data: null, error: null });
  builder.upsert = () => Promise.resolve({ error: null });

  const channelObj: any = {};
  channelObj.on = (_evento: string, _filtro: unknown, handler: (payload: { new: unknown }) => void) => {
    handlerPostgresChanges = handler;
    return channelObj;
  };
  channelObj.subscribe = (cb?: (status: string) => void) => {
    cb?.('SUBSCRIBED');
    return channelObj;
  };

  return {
    from: () => builder,
    channel: () => channelObj,
    removeChannel: () => {},
    dispararPostgresChanges: (linha: unknown) => handlerPostgresChanges?.({ new: linha }),
  };
}

describe('iniciarSyncMapaAtivo — eco remoto atrasado não reverte troca local em voo', () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    useStore.setState(criarEstadoInicial());
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it('mapa ativo trocado duas vezes rápido: eco da 1a troca não reverte a 2a ainda não pushada', () => {
    const mock = criarClienteComEventoRealtime();
    h.clienteAtual = mock;
    cleanup = iniciarSyncMapaAtivo();

    useStore.getState().selecionarMapaAtivo('mapa-a'); // 1a troca — agenda o push
    useStore.getState().selecionarMapaAtivo('mapa-b'); // 2a troca, ainda dentro da janela — deve sobreviver

    // eco Realtime do push da 1a troca chega ANTES da 2a confirmar.
    mock.dispararPostgresChanges({ id: 'mapa', mapa_ativo_id: 'mapa-a' });

    expect(useStore.getState().mapa.mapaAtivoId).toBe('mapa-b');
  });
});
