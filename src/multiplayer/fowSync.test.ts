import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarEstadoInicial, criarFoWVazio } from '../state/factories';
import { useStore } from '../state/store';
import { paraEstadoFoW, paraLinha } from './fowSync';

describe('paraLinha / paraEstadoFoW', () => {
  it('round-trip preserva o fow (vistas, visiveisAgora, zonaAtual, ativa)', () => {
    const fow = {
      ...criarFoWVazio(),
      vistas: [{ id: 'r1', forma: 'rect' as const, x: 0, y: 0, w: 0.5, h: 0.5 }],
      visiveisAgora: [{ id: 'r1', forma: 'rect' as const, x: 0, y: 0, w: 0.5, h: 0.5 }],
      zonaAtual: 'corporativo' as const,
      ativa: true,
    };
    const linha = paraLinha(fow);
    expect(linha).toEqual({
      vistas: fow.vistas,
      visiveis_agora: fow.visiveisAgora,
      proximo_id_zona: 'corporativo',
      ativa: true,
    });

    const reconstruido = paraEstadoFoW(linha);
    expect(reconstruido).toEqual(fow);
  });

  it('ativa ausente (coluna nova, banco sem a migration 0028) cai pra false, não undefined', () => {
    // simula uma linha gravada antes da migration 0028 rodar no banco remoto — mesmo cenário
    // que causava o push silencioso do toggle "fow" nunca refletir pro jogador.
    const linhaAntiga = { vistas: [], visiveis_agora: [], proximo_id_zona: null, ativa: null };
    expect(paraEstadoFoW(linhaAntiga).ativa).toBe(false);
  });

  it('vistas/visiveis_agora corrompidos (não-array) caem pra lista vazia', () => {
    // linha corrompida/parcial vinda do banco não deve propagar um `.map`/`.filter` quebrado
    // pro resto do app (mesmo princípio de `validarPayload.ts` nos canais de broadcast).
    const linhaCorrompida = {
      vistas: null as unknown as [],
      visiveis_agora: undefined as unknown as [],
      proximo_id_zona: null,
      ativa: false,
    };
    const estado = paraEstadoFoW(linhaCorrompida);
    expect(estado.vistas).toEqual([]);
    expect(estado.visiveisAgora).toEqual([]);
  });
});

// ===== refetch de reconexão (iniciarSyncFoW) =====
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

const { iniciarSyncFoW } = await import('./fowSync');

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

describe('iniciarSyncFoW — refetch de reconexão', () => {
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

  it('canal cai e reconecta rebusca o FoW, mesmo sem evento Realtime durante a queda', async () => {
    cleanup = iniciarSyncFoW();

    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(1));
    mock.resolvers[0](null); // busca inicial: sem FoW configurado ainda

    // canal cai e reconecta — o mestre revelou uma região em outra aba enquanto este cliente
    // estava desconectado, sem nenhum evento `postgres_changes` chegar aqui.
    mock.statusCb?.('CHANNEL_ERROR');
    mock.statusCb?.('SUBSCRIBED');

    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(2));
    mock.resolvers[1]({
      id: 'fow',
      vistas: [{ id: 'r1', forma: 'rect', x: 0, y: 0, w: 0.5, h: 0.5 }],
      visiveis_agora: [],
      proximo_id_zona: null,
      ativa: true,
      version: 1,
    });

    await vi.waitFor(() => {
      expect(useStore.getState().mapa.fow.vistas).toHaveLength(1);
    });
    expect(useStore.getState().mapa.fow.ativa).toBe(true);
  });
});

// ===== eco remoto durante o round-trip do upsert não reverte a revelação local (achado pré-sessão) =====
describe('iniciarSyncFoW — eco remoto em voo não reverte revelação local pendente', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    h.clienteAtual = null;
    vi.restoreAllMocks();
  });

  it('revelar uma região e receber o eco do upsert anterior (ainda não confirmado) não apaga a revelação', async () => {
    useStore.setState(criarEstadoInicial());

    let handlerPostgresChanges: ((payload: { new: unknown }) => void) | undefined;
    const upsertResolvers: Array<() => void> = [];

    const builder: any = {};
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.maybeSingle = () => Promise.resolve({ data: null, error: null });
    builder.upsert = () =>
      new Promise((resolve) => {
        upsertResolvers.push(() => resolve({ error: null }));
      });

    const channelObj: any = {};
    channelObj.on = (_evento: string, _filtro: unknown, handler: (payload: { new: unknown }) => void) => {
      handlerPostgresChanges = handler;
      return channelObj;
    };
    channelObj.subscribe = (cb?: (status: string) => void) => {
      cb?.('SUBSCRIBED');
      return channelObj;
    };

    h.clienteAtual = { from: () => builder, channel: () => channelObj, removeChannel: () => {} };
    cleanup = iniciarSyncFoW();

    // revela uma região — dispara o upsert (ainda não resolvido, ver `upsertResolvers`).
    useStore.setState((s) => ({
      mapa: { ...s.mapa, fow: { ...s.mapa.fow, vistas: [{ id: 'r1', forma: 'rect', x: 0, y: 0, w: 0.5, h: 0.5 }] } },
    }));

    // eco Realtime chega ANTES desse upsert confirmar — payload reflete o estado ANTERIOR à
    // revelação (sem `r1`), como um segundo cliente reconectando ou o eco de um upsert anterior.
    handlerPostgresChanges?.({ new: { id: 'fow', vistas: [], visiveis_agora: [], proximo_id_zona: null, ativa: false, version: 1 } });

    expect(useStore.getState().mapa.fow.vistas).toHaveLength(1);
  });
});
