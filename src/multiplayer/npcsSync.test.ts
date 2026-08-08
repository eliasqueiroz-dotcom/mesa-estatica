import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarEstadoInicial, criarNpcVazio } from '../state/factories';
import { useStore } from '../state/store';
import { paraLinhaPublico, paraNpcPublico, paraNpcSemNotasMestre } from './npcsSync';

describe('paraLinhaPublico / paraNpcSemNotasMestre', () => {
  it('round-trip preserva os campos públicos do NPC', () => {
    const npc = {
      ...criarNpcVazio(),
      nome: 'Guarda 1',
      corVisual: '#5a7d9a',
      silhueta: 'guarda',
      foto: 'data:image/jpeg;base64,xyz',
      pvAtual: 8,
      defesa: 12,
      visivel: true,
      notasMestre: 'segredo — nunca deve ir pra linha pública',
    };

    const linha = paraLinhaPublico(npc);
    const reconstruido = paraNpcSemNotasMestre(linha);

    expect(reconstruido).toEqual({
      id: npc.id,
      nome: 'Guarda 1',
      corVisual: '#5a7d9a',
      silhueta: 'guarda',
      foto: 'data:image/jpeg;base64,xyz',
      pvAtual: 8,
      pvMaximo: npc.pvMaximo,
      defesa: 12,
      agilidade: npc.agilidade,
      notas: npc.notas,
      categoria: npc.categoria,
      acoes: npc.acoes,
      visivel: true,
    });
    expect(reconstruido).not.toHaveProperty('notasMestre');
  });

  it('foto/silhueta null viram null na linha (não undefined)', () => {
    const npc = { ...criarNpcVazio(), foto: null, silhueta: null };
    const linha = paraLinhaPublico(npc);
    expect(linha.foto).toBeNull();
    expect(linha.silhueta).toBeNull();
  });
});

describe('paraNpcPublico', () => {
  it('traz só o que o jogador vê — nunca notasMestre, mesmo que a linha privada exista em algum lugar do fluxo', () => {
    const npc = { ...criarNpcVazio(), nome: 'Guarda 1', corVisual: '#5a7d9a', silhueta: 'guarda', foto: null, visivel: true };
    const linha = paraLinhaPublico(npc);
    const publico = paraNpcPublico(linha);

    expect(publico).toEqual({
      id: npc.id,
      nome: 'Guarda 1',
      corVisual: '#5a7d9a',
      silhueta: 'guarda',
      foto: null,
      visivel: true,
    });
  });
});

// ===== guard de corrida (iniciarSyncNpcs) =====
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

const { iniciarSyncNpcs } = await import('./npcsSync');

function criarClienteComControle() {
  const resolvers: Array<(data: any) => void> = [];
  const handlers: Array<(payload: any) => void> = [];

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
    builder.insert = vi.fn(() => Promise.resolve({ error: null }));
    builder.upsert = vi.fn(() => Promise.resolve({ error: null }));
    builder.update = vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ error: null })),
    }));
    builder.delete = vi.fn(() => ({
      eq: vi.fn(() => ({
        then: (cb: (r: any) => void) => cb({ error: null }),
      })),
      not: vi.fn(() => ({
        is: vi.fn(() => ({
          then: (cb: (r: any) => void) => cb({ error: null }),
        })),
      })),
    }));
    return builder;
  }

  const from = vi.fn(() => criarBuilder());

  const channelObj: any = {};
  channelObj.on = vi.fn((_event: string, _filter: object, handler: (payload: any) => void) => {
    handlers.push(handler);
    return channelObj;
  });
  channelObj.subscribe = vi.fn((cb: (status: string) => void) => {
    cb('SUBSCRIBED');
    return channelObj;
  });
  const channel = vi.fn(() => channelObj);
  const removeChannel = vi.fn();

  return { from, channel, channelObj, handlers, resolvers, removeChannel };
}

function npcRemoto(id: string, nome: string) {
  return {
    id, nome, cor_visual: '#fff', silhueta: null, foto: null,
    pv_atual: 10, pv_maximo: 10, defesa: 10, agilidade: 1,
    notas: '', categoria: '', acoes: [], visivel: true,
  };
}

function linhasPrivadasVazias(npcId: string) {
  return { id: npcId, notas_mestre: '' };
}

describe('iniciarSyncNpcs — guard de corrida', () => {
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
  });

  it('edição local concorrente vence o dado remoto obtido antes da edição', async () => {
    const npcId = 'npc-remoto-1';
    useStore.getState().adicionarNpc();
    const localId = useStore.getState().npcs[0].id;
    useStore.getState().atualizarNpc(localId, { nome: 'Guarda Local' });

    cleanup = iniciarSyncNpcs();

    // aguarda a microtask da busca inicial agendar os fetches
    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(2));

    // resolve busca inicial (2 selects *)
    mock.resolvers[0]([]); // npcs_publico vazio
    mock.resolvers[1]([]); // npcs_privado vazio

    // dispara evento remoto (simula que outro cliente criou/alterou o npc-remoto-1)
    const handler = mock.handlers[0];
    expect(handler).toBeDefined();
    handler({ new: { id: npcId }, old: {} });

    // aguarda a microtask do handler → aplicarRemoto → buscarEMontar
    // buscarEMontar faz Promise.all de 2 maybeSingle (publico + privado)
    // isso empurra +2 resolvers (índices 2 e 3)
    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(4));

    // ANTES de resolver o fetch remoto, edita localmente
    useStore.getState().atualizarNpc(localId, { nome: 'Guarda Editado Durante Fetch' });

    // resolve o fetch remoto com dados antigos
    mock.resolvers[2](npcRemoto(npcId, 'Guarda Remoto'));
    mock.resolvers[3](linhasPrivadasVazias(npcId));

    // deixa as promises resolverem
    await vi.waitFor(() => {
      const npcs = useStore.getState().npcs;
      return npcs.some((n) => n.id === npcId);
    });

    // a edição local deve ter sobrevivido
    const guardaLocal = useStore.getState().npcs.find((n) => n.id === localId);
    expect(guardaLocal?.nome).toBe('Guarda Editado Durante Fetch');
  });

  it('sem edição concorrente, dado remoto é aplicado normalmente', async () => {
    cleanup = iniciarSyncNpcs();

    // aguarda busca inicial
    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(2));
    mock.resolvers[0]([]);
    mock.resolvers[1]([]);

    const npcId = 'npc-remoto-2';
    const handler = mock.handlers[0];
    handler({ new: { id: npcId }, old: {} });

    await vi.waitFor(() => expect(mock.resolvers.length).toBeGreaterThanOrEqual(4));

    // resolve com dados remotos (sem edição local concorrente)
    mock.resolvers[2](npcRemoto(npcId, 'Guarda do Servidor'));
    mock.resolvers[3](linhasPrivadasVazias(npcId));

    await vi.waitFor(() => {
      const npcs = useStore.getState().npcs;
      return npcs.some((n) => n.id === npcId && n.nome === 'Guarda do Servidor');
    });
  });
});
