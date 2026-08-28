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

  it('marca "em voo" no momento em que o diff detecta a mudança — mesmo enquanto o throttle ainda não disparou a chamada de rede', () => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', criarStorageFalso());

    cleanup = iniciarSyncTokens();
    const t = token('token-1');
    useStore.setState((s) => ({ mapa: { ...s.mapa, tokens: [...s.mapa.tokens, t] } }));
    // a primeira chamada do throttle (chave fria) já disparou a rede na hora — move de novo,
    // agora dentro do cooldown, pra cobrir o caso em que a chamada fica só "pendente" (nem
    // chegou a rodar `executarComRetentativa`, que tem seu próprio `marcarEmVoo`) — se a marca
    // já existe aqui, uma aba fechada NESSE exato meio-tempo não perde a posição (achado de
    // 23/08).
    useStore.getState().moverTokenMapa('token-1', 0.4, 0.4);

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
  // upsert real vira rede de verdade (round-trip com latência) — deixar sem resolver até o
  // teste mandar explicitamente simula esse "em voo", em vez do antigo `Promise.resolve()`
  // instantâneo, que resolvia via microtask antes de qualquer `await` no teste conseguir
  // testar a janela de escrita ainda não confirmada.
  const upsertResolvers: Array<(resultado: { error: unknown }) => void> = [];
  const handlers: Array<(payload: any) => void> = [];
  let statusCb: ((status: string) => void) | undefined;

  const builder: any = {};
  builder.select = () => builder;
  builder.then = (onFulfilled: (result: { data: unknown; error: null }) => void) => {
    return new Promise((resolve) => {
      resolvers.push((data: unknown) => resolve(onFulfilled({ data, error: null })));
    });
  };
  builder.upsert = () => new Promise((resolve) => upsertResolvers.push(resolve));
  builder.delete = () => builder;
  builder.eq = () => Promise.resolve({ error: null });

  const channelObj: any = {};
  channelObj.on = (_event: string, _filter: object, handler: (payload: any) => void) => {
    handlers.push(handler);
    return channelObj;
  };
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
    upsertResolvers,
    handlers,
    get statusCb() {
      return statusCb;
    },
  };
}

function tokenRemoto(id: string, participanteId: string, x: number, y: number) {
  return { id, participante_id: participanteId, tipo: 'pc' as const, x, y };
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
    vi.unstubAllGlobals();
    vi.useRealTimers();
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

  // ===== anti-eco (pendencias) — causa raiz do "rollback geral" com 2+ conectados =====

  it('refetch de reconexão nunca sobrescreve uma posição local ainda pendente de push', async () => {
    cleanup = iniciarSyncTokens();

    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(1));
    mock.resolvers[0]([tokenRemoto('tok-pend', 'pc-pend', 0.1, 0.1)]);
    await vi.waitFor(() => expect(useStore.getState().mapa.tokens.some((t) => t.id === 'tok-pend')).toBe(true));

    // move localmente (coordenada normalizada 0-1, `moverTokenMapa` clampa) — upsert agendado
    // pelo debounce (ATRASO_PUSH_MS), nunca disparado aqui
    useStore.getState().moverTokenMapa('tok-pend', 0.55, 0.55);

    // canal cai e reconecta ENQUANTO o push local ainda não confirmou no servidor
    mock.statusCb?.('CHANNEL_ERROR');
    mock.statusCb?.('SUBSCRIBED');

    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(2));
    mock.resolvers[1]([tokenRemoto('tok-pend', 'pc-pend', 0.1, 0.1)]); // servidor ainda tem a posição antiga

    await vi.waitFor(() => {
      const t = useStore.getState().mapa.tokens.find((tk) => tk.id === 'tok-pend');
      expect(t?.x).toBe(0.55);
      expect(t?.y).toBe(0.55);
    });
  });

  it('refetch de reconexão aplica posição remota nova para token sem edição local pendente', async () => {
    cleanup = iniciarSyncTokens();

    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(1));
    mock.resolvers[0]([tokenRemoto('tok-livre', 'pc-livre', 1, 1)]);
    await vi.waitFor(() => expect(useStore.getState().mapa.tokens.some((t) => t.id === 'tok-livre')).toBe(true));

    mock.statusCb?.('CHANNEL_ERROR');
    mock.statusCb?.('SUBSCRIBED');

    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(2));
    mock.resolvers[1]([tokenRemoto('tok-livre', 'pc-livre', 77, 88)]);

    await vi.waitFor(() => {
      const t = useStore.getState().mapa.tokens.find((tk) => tk.id === 'tok-livre');
      expect(t?.x).toBe(77);
      expect(t?.y).toBe(88);
    });
  });

  it('handler de postgres_changes ignora payload remoto enquanto há upsert local pendente, fora da janela de arrasto', async () => {
    cleanup = iniciarSyncTokens();

    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(1));
    mock.resolvers[0]([tokenRemoto('tok-pg', 'pc-pg', 0.05, 0.05)]);
    await vi.waitFor(() => expect(useStore.getState().mapa.tokens.some((t) => t.id === 'tok-pg')).toBe(true));

    // solta o token (pointerup já rodou, tokensEmArrasto vazio) mas o upsert debounçado ainda
    // não confirmou — só `pendencias` protege essa janela.
    useStore.getState().moverTokenMapa('tok-pg', 0.6, 0.6);

    const handler = mock.handlers[0];
    expect(handler).toBeDefined();
    handler({ eventType: 'UPDATE', new: tokenRemoto('tok-pg', 'pc-pg', 0.05, 0.05), old: {} });

    const token = useStore.getState().mapa.tokens.find((t) => t.id === 'tok-pg');
    expect(token?.x).toBe(0.6);
    expect(token?.y).toBe(0.6);
  });

  it('refetch de reconexão preserva token recém-criado localmente e ainda não confirmado no servidor', async () => {
    cleanup = iniciarSyncTokens();

    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(1));
    mock.resolvers[0]([]); // mapa vazio no boot

    useStore.getState().adicionarTokenMapa('pc-novo', 'pc');
    const novoId = useStore.getState().mapa.tokens[0].id;

    mock.statusCb?.('CHANNEL_ERROR');
    mock.statusCb?.('SUBSCRIBED');

    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(2));
    mock.resolvers[1]([]); // servidor ainda não recebeu o insert (upsert em voo)

    await vi.waitFor(() => {
      expect(useStore.getState().mapa.tokens.some((t) => t.id === novoId)).toBe(true);
    });
  });

  it('pendencias é limpo quando o throttle dispara a chamada de rede — refetch de reconexão volta a aplicar o remoto depois disso', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', criarStorageFalso());
    cleanup = iniciarSyncTokens();

    expect(mock.resolvers.length).toBeGreaterThanOrEqual(1);
    mock.resolvers[0]([tokenRemoto('tok-limpa', 'pc-limpa', 0.1, 0.1)]);
    expect(useStore.getState().mapa.tokens.some((t) => t.id === 'tok-limpa')).toBe(true);

    // chave fria — o throttle dispara o upsert na hora, sem esperar timer; `pendencias` só é
    // limpo quando a escrita CONFIRMA (ver comentário em `tokensSync.ts`), então resolve o
    // upsert explicitamente aqui pra simular a confirmação do servidor.
    useStore.getState().moverTokenMapa('tok-limpa', 0.2, 0.2);
    expect(mock.upsertResolvers.length).toBeGreaterThanOrEqual(1);
    mock.upsertResolvers[0]({ error: null });

    // avança além do ATRASO_PUSH_MS (150ms) — sem mais chamadas nesse meio-tempo, o cooldown do
    // throttle termina sem nada pendente e a chave volta a ficar fria
    await vi.advanceTimersByTimeAsync(200);

    mock.statusCb?.('CHANNEL_ERROR');
    mock.statusCb?.('SUBSCRIBED');
    expect(mock.resolvers.length).toBeGreaterThanOrEqual(2);
    mock.resolvers[1]([tokenRemoto('tok-limpa', 'pc-limpa', 0.99, 0.99)]); // servidor confirma outro valor

    const token = useStore.getState().mapa.tokens.find((t) => t.id === 'tok-limpa');
    expect(token?.x).toBe(0.99);
  });
});
