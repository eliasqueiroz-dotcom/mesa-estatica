import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarEstadoInicial } from '../state/factories';
import { useStore } from '../state/store';
import { computarDiffSons, paraLinha, paraSom, resolverReplaySom } from './soundpadSync';

const som = (slot: number, nome: string, extra?: Partial<{ id: string; path: string; url: string }>) => ({
  id: extra?.id ?? `id-${slot}`,
  slot,
  nome,
  path: extra?.path ?? `sfx/${nome}`,
  url: extra?.url ?? `https://x/${nome}`,
});

describe('mapeadores', () => {
  it('paraLinha e paraSom são simétricos (camel ↔ snake)', () => {
    const original = som(2, 'porta');
    expect(paraSom(paraLinha(original))).toEqual(original);
  });

  it('paraLinha traduz path para storage_path', () => {
    expect(paraLinha(som(0, 'tiro')).storage_path).toBe('sfx/tiro');
  });
});

describe('computarDiffSons', () => {
  it('slot novo entra como upsert', () => {
    const { upserts, removidos } = computarDiffSons([], [som(0, 'tiro')]);
    expect(upserts.map((s) => s.slot)).toEqual([0]);
    expect(removidos).toEqual([]);
  });

  it('slot inalterado não gera upsert', () => {
    const lista = [som(0, 'tiro'), som(3, 'porta')];
    const { upserts, removidos } = computarDiffSons(lista, [...lista]);
    expect(upserts).toEqual([]);
    expect(removidos).toEqual([]);
  });

  // substituir o som de um botão troca o id — se o diff fosse por id, viraria
  // "remove um + cria outro", e o delete correria contra o insert (slot é unique).
  it('substituir o som de um slot vira um upsert só, sem remoção', () => {
    const antes = [som(1, 'porta', { id: 'antigo' })];
    const depois = [som(1, 'vidro', { id: 'novo' })];
    const { upserts, removidos } = computarDiffSons(antes, depois);
    expect(upserts.map((s) => s.nome)).toEqual(['vidro']);
    expect(removidos).toEqual([]);
  });

  it('slot esvaziado vira remoção', () => {
    const { upserts, removidos } = computarDiffSons([som(4, 'grito')], []);
    expect(upserts).toEqual([]);
    expect(removidos.map((s) => s.slot)).toEqual([4]);
  });

  it('mexer num slot não afeta os outros', () => {
    const antes = [som(0, 'a'), som(1, 'b')];
    const depois = [som(0, 'a'), som(1, 'b-novo')];
    const { upserts, removidos } = computarDiffSons(antes, depois);
    expect(upserts.map((s) => s.slot)).toEqual([1]);
    expect(removidos).toEqual([]);
  });
});

describe('resolverReplaySom', () => {
  it('chave normal (slot como string) que ainda existe localmente devolve o som pra reenviar', () => {
    const s = som(2, 'porta');
    expect(resolverReplaySom('2', [s])).toEqual(s);
  });

  it('chave normal que não existe mais localmente (slot esvaziado) devolve null', () => {
    expect(resolverReplaySom('9', [som(2, 'porta')])).toBeNull();
  });

  it('chave "delete:<slot>" sempre devolve \'apagar\'', () => {
    expect(resolverReplaySom('delete:4', [som(4, 'grito')])).toBe('apagar');
    expect(resolverReplaySom('delete:4', [])).toBe('apagar');
  });
});

// ===== marcarEmVoo na janela do debounce (iniciarSyncSoundpad) =====
const h = vi.hoisted(() => ({ clienteAtual: null as unknown }));
vi.mock('../lib/supabaseClient', () => ({
  get supabase() {
    return h.clienteAtual;
  },
}));
vi.mock('../lib/statusMesa', () => ({
  assinarStatusCanal: vi.fn(() => vi.fn()),
  desconectarCanal: vi.fn(),
  useStatusMesa: {
    getState: vi.fn(() => ({ canaisConectados: new Set(), canaisComErro: new Set() })),
    setState: vi.fn(),
    subscribe: vi.fn(),
  },
}));

const { iniciarSyncSoundpad } = await import('./soundpadSync');
const { retomarPendenciasPersistidas } = await import('./filaPendencias');

/** Cliente mínimo — só o suficiente pra `iniciarSyncSoundpad()` montar sem lançar. Não precisa
 *  simular sucesso/falha de rede porque o teste abaixo nunca deixa o debounce disparar. */
function criarClienteMinimo() {
  const resolvido = { data: null, error: null };
  const builder: any = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.maybeSingle = () => Promise.resolve(resolvido);
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

function criarStorageFalso() {
  const dados = new Map<string, string>();
  return {
    getItem: (chave: string) => dados.get(chave) ?? null,
    setItem: (chave: string, valor: string) => {
      dados.set(chave, valor);
    },
  };
}

describe('iniciarSyncSoundpad — marca "em voo" antes do debounce disparar', () => {
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

  it('marca "em voo" (chave = slot) no momento em que agenda o upsert de um som — antes do debounce disparar', () => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', criarStorageFalso());

    cleanup = iniciarSyncSoundpad();
    useStore.getState().definirSomSoundpad(2, 'porta', 'sfx/porta.mp3', 'https://x/porta.mp3');

    // o timer do debounce nem chegou a disparar (fake timers, nunca avançados) — se a marca já
    // existe aqui, uma aba fechada NESSE exato meio-tempo não perde o som (achado de 23/08).
    expect(retomarPendenciasPersistidas('soundpad-sync')).toContain('2');
  });

  it('o branch de "estado" (volume/disparo) não usa debounce — já cai direto na fila em voo, sem precisar de marca extra', () => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', criarStorageFalso());

    cleanup = iniciarSyncSoundpad();
    useStore.getState().definirVolumeSoundpad(0.5);

    expect(retomarPendenciasPersistidas('soundpad-sync')).toContain('estado');
  });
});
