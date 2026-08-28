import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarEstadoInicial } from '../state/factories';
import { useStore } from '../state/store';

// ===== marcarEmVoo na janela do debounce (iniciarSyncMapaPublico) =====
// Sem cobertura geral do módulo aqui de propósito — só o comportamento de durabilidade
// (mesmo achado de 23/08 que motivou `marcarEmVoo` em filaPendencias.ts). Módulo não tinha
// nenhum teste antes disto.
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

const { iniciarSyncMapaPublico } = await import('./mapaPublicoSync');
const { retomarPendenciasPersistidas } = await import('./filaPendencias');

/** Cliente mínimo — só o suficiente pra `iniciarSyncMapaPublico()` montar sem lançar. Não
 *  precisa simular sucesso/falha de rede porque o teste abaixo nunca deixa o debounce disparar. */
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

describe('iniciarSyncMapaPublico — marca "em voo" antes do debounce disparar', () => {
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

  it('marca "em voo" (chave fixa "mapa") no momento em que agenda o push — antes do debounce disparar', () => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', criarStorageFalso());

    cleanup = iniciarSyncMapaPublico();
    useStore.setState((s) => ({ mapa: { ...s.mapa, grade: { ...s.mapa.grade, ativa: true } } }));

    // o timer do debounce nem chegou a disparar (fake timers, nunca avançados) — se a marca já
    // existe aqui, uma aba fechada NESSE exato meio-tempo não perde o ajuste (achado de 23/08).
    expect(retomarPendenciasPersistidas('mapa-publico-sync')).toContain('mapa');
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

describe('iniciarSyncMapaPublico — refetch de reconexão', () => {
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

  it('canal cai e reconecta rebusca o mapa, mesmo sem evento Realtime durante a queda', async () => {
    cleanup = iniciarSyncMapaPublico();

    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(1));
    mock.resolvers[0](null); // busca inicial: sem linha ainda

    // canal cai e reconecta — o mestre trocou o fundo do mapa em outra aba enquanto este
    // cliente estava desconectado, sem nenhum evento `postgres_changes` chegar aqui.
    mock.statusCb?.('CHANNEL_ERROR');
    mock.statusCb?.('SUBSCRIBED');

    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(2));
    mock.resolvers[1]({ id: 'mapa', imagem_data_url: 'https://cdn.exemplo/mapa-novo.jpg', grade: { ativa: true } });

    await vi.waitFor(() => {
      expect(useStore.getState().mapa.imagemDataUrl).toBe('https://cdn.exemplo/mapa-novo.jpg');
    });
  });
});

// ===== eco remoto durante a janela de debounce não reverte a edição local (achado pré-sessão) =====
function criarClienteComEventoRealtime() {
  let handlerPostgresChanges: ((payload: { new: unknown }) => void) | undefined;

  const builder: any = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.maybeSingle = () => Promise.resolve({ data: null, error: null }); // sem linha ainda
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

describe('iniciarSyncMapaPublico — eco remoto atrasado não reverte edição local em voo', () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    useStore.setState(criarEstadoInicial());
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it('grid ajustado duas vezes rápido: eco do 1o push não apaga o 2o ajuste ainda não pushado', async () => {
    const mock = criarClienteComEventoRealtime();
    h.clienteAtual = mock;
    cleanup = iniciarSyncMapaPublico();

    // 1a edição — agenda o push (debounce ainda não disparou).
    useStore.setState((s) => ({ mapa: { ...s.mapa, grade: { ...s.mapa.grade, colunas: 8 } } }));
    // 2a edição, ainda dentro da janela de debounce — o valor que deve sobreviver.
    useStore.setState((s) => ({ mapa: { ...s.mapa, grade: { ...s.mapa.grade, colunas: 12 } } }));

    // eco Realtime do 1o push chega ANTES do debounce da 2a edição disparar — payload reflete
    // o valor antigo (colunas: 8), não a edição mais recente do mestre.
    mock.dispararPostgresChanges({ id: 'mapa', imagem_data_url: null, grade: { ...useStore.getState().mapa.grade, colunas: 8 } });

    expect(useStore.getState().mapa.grade.colunas).toBe(12);
  });
});
