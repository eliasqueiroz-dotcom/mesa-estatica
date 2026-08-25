import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenMapa } from '../state/types';
import { criarEstadoInicial } from '../state/factories';
import { useStore } from '../state/store';
import { resolverReplayToken } from './tokensSync';

const token = (id: string): TokenMapa => ({ id, participanteId: `p-${id}`, tipo: 'pc', x: 0, y: 0 });

describe('resolverReplayToken', () => {
  it('chave normal (id de token) que ainda existe localmente devolve o token pra reenviar', () => {
    const tokens = [token('a'), token('b')];
    expect(resolverReplayToken('a', tokens)).toEqual(token('a'));
  });

  it('chave normal que não existe mais localmente devolve null (nada a fazer)', () => {
    expect(resolverReplayToken('sumiu', [token('a')])).toBeNull();
  });

  it('chave "delete:<id>" sempre devolve \'apagar\', mesmo se o id nunca existiu localmente', () => {
    expect(resolverReplayToken('delete:x', [token('a')])).toBe('apagar');
    expect(resolverReplayToken('delete:x', [])).toBe('apagar');
  });

  it('lista vazia de tokens não quebra a resolução', () => {
    expect(resolverReplayToken('a', [])).toBeNull();
  });
});

// ===== marcarEmVoo na janela do debounce (iniciarSyncTokens) =====
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

const { iniciarSyncTokens } = await import('./tokensSync');
const { retomarPendenciasPersistidas } = await import('./filaPendencias');

/** Cliente mínimo — só o suficiente pra `iniciarSyncTokens()` montar sem lançar (busca inicial
 *  resolve pra "sem dado", canal Realtime "assina" sem fazer nada de verdade). Não precisa
 *  simular sucesso/falha de rede porque o teste abaixo nunca deixa o debounce disparar. */
function criarClienteMinimo() {
  const resolvido = { data: null, error: null };
  const builder: any = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.in = () => Promise.resolve({ error: null });
  builder.then = (resolve: (r: typeof resolvido) => unknown) => Promise.resolve(resolvido).then(resolve);
  builder.upsert = () => Promise.resolve({ error: null });
  builder.delete = () => builder;

  const channelObj: any = {};
  channelObj.on = () => channelObj;
  channelObj.subscribe = (cb?: (status: string) => void) => {
    cb?.('SUBSCRIBED');
    return channelObj;
  };

  return { from: () => builder, channel: () => channelObj, removeChannel: () => {} };
}

describe('iniciarSyncTokens — marca "em voo" antes do debounce disparar', () => {
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

  it('marca "em voo" no momento em que agenda o upsert — antes do debounce (ATRASO_PUSH_MS) disparar', () => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', criarStorageFalso());

    cleanup = iniciarSyncTokens();
    const t = token('token-1');
    useStore.setState((s) => ({ mapa: { ...s.mapa, tokens: [...s.mapa.tokens, t] } }));

    // o timer do debounce nem chegou a disparar (fake timers, nunca avançados) — se a marca já
    // existe aqui, uma aba fechada NESSE exato meio-tempo não perde a posição (achado de 23/08).
    expect(retomarPendenciasPersistidas('tokens-sync')).toContain('token-1');
  });
});

function criarStorageFalso() {
  const dados = new Map<string, string>();
  return {
    getItem: (chave: string) => dados.get(chave) ?? null,
    setItem: (chave: string, valor: string) => {
      dados.set(chave, valor);
    },
  };
}

// ===== refetch de reconexão =====
function criarClienteComControle() {
  const resolvers: Array<(data: unknown) => void> = [];
  let statusCb: ((status: string) => void) | undefined;

  const builder: any = {};
  builder.select = () => builder;
  builder.then = (onFulfilled: (result: { data: unknown; error: null }) => void) => {
    return new Promise((resolve) => {
      resolvers.push((data: unknown) => resolve(onFulfilled({ data, error: null })));
    });
  };
  builder.upsert = () => Promise.resolve({ error: null });
  builder.delete = () => builder;
  builder.eq = () => Promise.resolve({ error: null });

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

describe('iniciarSyncTokens — refetch de reconexão', () => {
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

  it('canal cai e reconecta rebusca os tokens, mesmo sem evento Realtime durante a queda', async () => {
    cleanup = iniciarSyncTokens();

    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(1));
    mock.resolvers[0]([]); // busca inicial: mapa vazio

    // canal cai e reconecta — um token foi movido em outra aba enquanto este cliente estava
    // desconectado, sem nenhum evento `postgres_changes` chegar aqui
    mock.statusCb?.('CHANNEL_ERROR');
    mock.statusCb?.('SUBSCRIBED');

    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(2));
    mock.resolvers[1]([{ id: 'tok-1', participante_id: 'pc-1', tipo: 'pc', x: 42, y: 7 }]);

    await vi.waitFor(() => {
      expect(useStore.getState().mapa.tokens.map((t) => t.id)).toEqual(['tok-1']);
    });
    expect(useStore.getState().mapa.tokens[0].x).toBe(42);
  });
});
