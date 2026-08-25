import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarEstadoInicial, criarSessaoPublica } from '../state/factories';
import { useStore } from '../state/store';
import { retomarPendenciasPersistidas } from './filaPendencias';
import { paraLinha, paraSessaoPublica } from './sessaoPublicaSync';

const criarStorageFalso = () => {
  const dados = new Map<string, string>();
  return {
    getItem: (chave: string) => dados.get(chave) ?? null,
    setItem: (chave: string, valor: string) => {
      dados.set(chave, valor);
    },
  };
};

describe('paraLinha / paraSessaoPublica', () => {
  it('round-trip preserva a sessão pública', () => {
    const sessao = { ...criarSessaoPublica(), nomeDaMesa: 'Estática', cenaAtual: 'beco sem saída', ameaca: 40 };
    const linha = paraLinha(sessao);
    const reconstruida = paraSessaoPublica({ id: 'sessao', ...linha });
    expect(reconstruida).toEqual(sessao);
  });

  it('condicao_duracao ausente (coluna nova, banco antigo) cai pra objeto vazio, não undefined', () => {
    const sessao = criarSessaoPublica();
    const linha = paraLinha(sessao);
    const linhaAntiga = { id: 'sessao', ...linha, condicao_duracao: undefined };
    expect(paraSessaoPublica(linhaAntiga).condicaoDuracao).toEqual({});
  });
});

// ===== guard de corrida (iniciarSyncSessaoPublica) =====
const h = vi.hoisted(() => ({ clienteAtual: null as unknown }));
vi.mock('../lib/supabaseClient', () => ({
  get supabase() {
    return h.clienteAtual;
  },
}));
vi.mock('../lib/statusMesa', () => ({
  assinarStatusCanal: vi.fn(() => vi.fn()),
  // mesma lógica de edge-detection do real (statusMesa.ts) — reimplementada aqui pra não
  // depender do módulo de verdade, mesmo espírito do resto deste mock.
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

const { iniciarSyncSessaoPublica } = await import('./sessaoPublicaSync');

function criarClienteComControle() {
  const resolvers: Array<(data: any) => void> = [];
  const handlers: Array<() => void> = [];
  const controleCanal: { cb?: (status: string) => void } = {};

  function criarBuilder(): any {
    const builder: any = {};
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.maybeSingle = vi.fn(() => {
      return new Promise<any>((resolve) => {
        resolvers.push((data: any) => resolve({ data, error: null }));
      });
    });
    builder.then = (onFulfilled: (result: { data: any; error: null }) => void) => {
      return new Promise((resolve) => {
        resolvers.push((data: any) => {
          resolve(onFulfilled({ data, error: null }));
        });
      });
    };
    builder.upsert = vi.fn(() => Promise.resolve({ error: null }));
    return builder;
  }

  const from = vi.fn(() => criarBuilder());

  const channelObj: any = {};
  channelObj.on = vi.fn((_event: string, _filter: object, handler: () => void) => {
    handlers.push(handler);
    return channelObj;
  });
  channelObj.subscribe = vi.fn((cb: (status: string) => void) => {
    controleCanal.cb = cb;
    cb('SUBSCRIBED');
    return channelObj;
  });
  const channel = vi.fn(() => channelObj);
  const removeChannel = vi.fn();

  return { from, channel, channelObj, handlers, resolvers, removeChannel, controleCanal };
}

function linhaRemota(override: Partial<ReturnType<typeof paraLinha>> = {}) {
  return {
    id: 'sessao',
    nome_da_mesa: 'Estática',
    numero_sessao: 1,
    clima: 'garoa',
    hora: '',
    cena_atual: 'beco',
    caso: '',
    local_atual: '',
    objetivo: '',
    progresso: { atual: 0, total: 0 },
    atmosfera: '',
    contador_cena: 1,
    modo_combate: false,
    turno_atual_id: null,
    rodada: 1,
    condicoes_combate: {},
    condicao_duracao: {},
    ameaca: 0,
    ruido_narrativo: 0,
    ...override,
  };
}

describe('iniciarSyncSessaoPublica — guard de corrida', () => {
  let mock: ReturnType<typeof criarClienteComControle>;
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    useStore.setState(criarEstadoInicial());
    mock = criarClienteComControle();
    h.clienteAtual = {
      from: mock.from,
      channel: mock.channel,
      removeChannel: mock.removeChannel,
    };
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    h.clienteAtual = null;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('edição local concorrente vence o dado remoto obtido antes da edição', async () => {
    cleanup = iniciarSyncSessaoPublica();

    // resolve busca inicial (maybeSingle da sessao_publica)
    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(1));
    mock.resolvers[0](linhaRemota()); // busca inicial, upsert do state

    // aguarda o setState da busca inicial
    await vi.waitFor(() => expect(useStore.getState().sessaoPublica.nomeDaMesa).toBe('Estática'));

    // dispara evento remoto
    const handler = mock.handlers[0];
    expect(handler).toBeDefined();
    handler();

    // handler → aplicarRemoto → fetch again → +1 resolver
    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(2));

    // edita localmente ANTES do fetch remoto resolver
    useStore.setState((s) => ({ sessaoPublica: { ...s.sessaoPublica, cenaAtual: 'editado localmente' } }));

    // resolve o fetch remoto com dado antigo
    mock.resolvers[1](linhaRemota({ cena_atual: 'dado remoto velho' }));

    await vi.waitFor(() => {
      return useStore.getState().sessaoPublica.cenaAtual !== 'dado remoto velho';
    });

    expect(useStore.getState().sessaoPublica.cenaAtual).toBe('editado localmente');
  });

  it('sem edição concorrente, dado remoto é aplicado normalmente', async () => {
    cleanup = iniciarSyncSessaoPublica();

    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(1));
    mock.resolvers[0](linhaRemota());

    await vi.waitFor(() => expect(useStore.getState().sessaoPublica.cenaAtual).toBe('beco'));

    const handler = mock.handlers[0];
    handler();

    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(2));
    mock.resolvers[1](linhaRemota({ cena_atual: 'nova cena remota' }));

    await vi.waitFor(() => {
      return useStore.getState().sessaoPublica.cenaAtual === 'nova cena remota';
    });
  });

  it('marca "em voo" (chave fixa "sessao") no momento em que agenda o push — antes do debounce disparar', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', criarStorageFalso());

    cleanup = iniciarSyncSessaoPublica();
    // libera a busca inicial (aplicarRemoto síncrono no boot, linha ~150 de sessaoPublicaSync.ts)
    // — sem isso `aplicandoRemotoContagem` fica travado em 1 e o subscriber de baixo nunca vê a
    // edição. `.maybeSingle()` empurra o resolver de forma síncrona, só o `finally` que decrementa
    // precisa de um microtask pra rodar (fake timers não afeta Promise, só setTimeout).
    mock.resolvers[0](linhaRemota());
    await Promise.resolve();
    await Promise.resolve();

    useStore.setState((s) => ({ sessaoPublica: { ...s.sessaoPublica, cenaAtual: 'editado' } }));

    // o timer do debounce nem chegou a disparar (fake timers, nunca avançados) — se a marca já
    // existe aqui, uma aba fechada NESSE exato meio-tempo não perde a edição (achado de 23/08).
    expect(retomarPendenciasPersistidas('sessao-publica-sync')).toContain('sessao');
  });

  it('canal cai e reconecta busca o estado atual, mesmo sem evento Realtime chegar durante a queda', async () => {
    cleanup = iniciarSyncSessaoPublica();

    // resolve busca inicial
    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(1));
    mock.resolvers[0](linhaRemota());
    await vi.waitFor(() => expect(useStore.getState().sessaoPublica.cenaAtual).toBe('beco'));

    // canal cai e volta — sem NENHUM evento `postgres_changes` (o cenário que o Realtime não
    // cobre sozinho: uma mudança feita pelo mestre enquanto este cliente estava desconectado).
    mock.controleCanal.cb?.('CHANNEL_ERROR');
    mock.controleCanal.cb?.('SUBSCRIBED');

    // reconexão deve ter disparado um novo fetch (refetch de `aplicarRemoto`)
    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(2));
    mock.resolvers[1](linhaRemota({ cena_atual: 'mudou enquanto eu estava fora' }));

    await vi.waitFor(() => {
      return useStore.getState().sessaoPublica.cenaAtual === 'mudou enquanto eu estava fora';
    });
  });
});
