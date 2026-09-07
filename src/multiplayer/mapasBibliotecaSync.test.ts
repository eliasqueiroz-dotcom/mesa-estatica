import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarFoWVazio, criarGradeInicial, criarEstadoInicial } from '../state/factories';
import type { MapaBiblioteca } from '../state/types';
import { useStore } from '../state/store';
import { paraLinha, paraMapa, resolverReplayMapa } from './mapasBibliotecaSync';

const mapa = (over: Partial<MapaBiblioteca> = {}): MapaBiblioteca => ({
  id: 'm1',
  nome: 'mapa 1',
  imagemPath: 'img/mapas/abc.jpg',
  imagemUrl: 'https://exemplo.test/mapas/abc.jpg',
  grade: criarGradeInicial(),
  fow: criarFoWVazio(),
  ordem: 0,
  criadoEm: '2026-07-24T00:00:00.000Z',
  ...over,
});

describe('paraLinha / paraMapa', () => {
  it('round-trip preserva os campos do mapa', () => {
    const m = mapa();
    const linha = paraLinha(m);
    expect(linha).toEqual({
      id: 'm1',
      nome: 'mapa 1',
      imagem_path: 'img/mapas/abc.jpg',
      imagem_url: m.imagemUrl,
      grade: m.grade,
      fow: m.fow,
      ordem: 0,
      criado_em: '2026-07-24T00:00:00.000Z',
    });
    expect(paraMapa(linha)).toEqual(m);
  });
});

describe('resolverReplayMapa', () => {
  const m = mapa();

  it('chave normal (id de mapa) que ainda existe localmente devolve o mapa pra reenviar', () => {
    expect(resolverReplayMapa('m1', [m])).toEqual(m);
  });

  it('chave normal que não existe mais localmente devolve null', () => {
    expect(resolverReplayMapa('sumiu', [m])).toBeNull();
  });

  it('chave "delete:<id>" sempre devolve \'apagar\'', () => {
    expect(resolverReplayMapa('delete:x', [m])).toBe('apagar');
    expect(resolverReplayMapa('delete:x', [])).toBe('apagar');
  });
});

// ===== marcarEmVoo + dataURL nunca sincroniza (iniciarSyncMapasBiblioteca) =====
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

const { iniciarSyncMapasBiblioteca } = await import('./mapasBibliotecaSync');
const { retomarPendenciasPersistidas } = await import('./filaPendencias');

/** Cliente falso com `upsert` espionado — sem linhas remotas ainda (`.then` resolve lista
 *  vazia), mesmo padrão de `criarClienteMinimo` em `midiaFaixasSync.test.ts`. */
function criarClienteComUpsertEspiao() {
  const chamadasUpsert: unknown[] = [];
  const resolvido = { data: [], error: null };
  const builder: any = {};
  builder.select = () => builder;
  builder.order = () => builder;
  builder.eq = () => builder;
  builder.then = (resolve: (r: typeof resolvido) => unknown) => Promise.resolve(resolvido).then(resolve);
  builder.upsert = (payload: unknown) => {
    chamadasUpsert.push(payload);
    return Promise.resolve({ error: null });
  };
  builder.delete = () => builder;

  const channelObj: any = {};
  channelObj.on = () => channelObj;
  channelObj.subscribe = (cb?: (status: string) => void) => {
    cb?.('SUBSCRIBED');
    return channelObj;
  };

  return { from: () => builder, channel: () => channelObj, removeChannel: () => {}, chamadasUpsert };
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

describe('iniciarSyncMapasBiblioteca', () => {
  let cleanup: (() => void) | undefined;
  let mock: ReturnType<typeof criarClienteComUpsertEspiao>;

  beforeEach(() => {
    useStore.setState(criarEstadoInicial());
    mock = criarClienteComUpsertEspiao();
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

  it('marca "em voo" no momento em que agenda o upsert — antes do debounce (ATRASO_PUSH_MS) disparar', () => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', criarStorageFalso());

    cleanup = iniciarSyncMapasBiblioteca();
    const id = useStore.getState().adicionarMapaBiblioteca('teste', 'img/mapas/teste.jpg', 'https://x/teste.jpg');

    expect(retomarPendenciasPersistidas('mapas-biblioteca-sync')).toContain(id);
  });

  it('item com imagem em dataURL (upload em voo, ou sem Supabase) nunca dispara upsert', () => {
    vi.useFakeTimers();
    cleanup = iniciarSyncMapasBiblioteca();
    useStore.getState().adicionarMapaBiblioteca('teste', '', 'data:image/jpeg;base64,xxxx');

    vi.advanceTimersByTime(2000);
    expect(mock.chamadasUpsert).toHaveLength(0);
  });

  it('trocar a dataURL pela URL real do Storage (upload concluído) dispara o upsert', () => {
    vi.useFakeTimers();
    cleanup = iniciarSyncMapasBiblioteca();
    const id = useStore.getState().adicionarMapaBiblioteca('teste', '', 'data:image/jpeg;base64,xxxx');
    vi.advanceTimersByTime(2000);
    expect(mock.chamadasUpsert).toHaveLength(0);

    useStore.getState().atualizarImagemMapaBiblioteca(id, 'img/mapas/teste.jpg', 'https://x/teste.jpg');
    vi.advanceTimersByTime(2000);

    expect(mock.chamadasUpsert).toHaveLength(1);
    expect(mock.chamadasUpsert[0]).toMatchObject({ id, imagem_path: 'img/mapas/teste.jpg', imagem_url: 'https://x/teste.jpg' });
  });
});
