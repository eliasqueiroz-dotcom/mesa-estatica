import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarEstadoInicial } from '../state/factories';
import { useStore } from '../state/store';

// ===== iniciarSyncLogRolls — insert de entrada nova e update de visibilidade (log e rolls) =====
const h = vi.hoisted(() => ({ clienteAtual: null as unknown }));
vi.mock('../lib/supabaseClient', () => ({
  get supabase() {
    return h.clienteAtual;
  },
}));
vi.mock('../lib/statusMesa', () => ({
  assinarStatusCanal: vi.fn(() => vi.fn()),
  desconectarCanal: vi.fn(),
}));

const { iniciarSyncLogRolls } = await import('./logRollsSync');

/** Cliente mínimo: busca inicial resolve vazia (`[]` pra `log_publico`/`rolls_publicas`),
 *  canal "assina" sem fazer nada de verdade, e `insert`/`update` registram o que foi chamado
 *  em vez de ir pra rede — o que interessa aqui é o DIFF local (o que o módulo decide empurrar),
 *  não o round-trip real. */
function criarClienteMinimo() {
  const inserts: { table: string; payload: any }[] = [];
  const updates: { table: string; payload: any; id: string }[] = [];

  function builderFor(table: string) {
    const b: any = {};
    b.select = () => b;
    b.order = () => b;
    // `data: null` (não `[]`) faz o boot da busca inicial retornar cedo sem tocar em
    // `log`/`rollsLog` (ver `if (!logRes.data && !rollsRes.data) return;` em logRollsSync.ts) —
    // evita uma corrida entre a resolução dessa busca (instantânea aqui, ao contrário da rede
    // real) e as chamadas síncronas de `registrarLog`/`registrarRoll` que os testes fazem logo
    // em seguida (mesmo padrão de `tokensSync.test.ts`).
    b.limit = () => Promise.resolve({ data: null, error: null });
    b.insert = (payload: any) => {
      inserts.push({ table, payload });
      return Promise.resolve({ error: null });
    };
    b.update = (payload: any) => {
      const upd: any = {};
      upd.eq = (_col: string, id: string) => {
        updates.push({ table, payload, id });
        return Promise.resolve({ error: null });
      };
      return upd;
    };
    b.delete = () => {
      const d: any = {};
      d.not = () => Promise.resolve({ error: null });
      return d;
    };
    return b;
  }

  const channelObj: any = {};
  channelObj.on = () => channelObj;
  channelObj.subscribe = (cb?: (status: string) => void) => {
    cb?.('SUBSCRIBED');
    return channelObj;
  };

  return {
    from: (table: string) => builderFor(table),
    channel: () => channelObj,
    removeChannel: () => {},
    inserts,
    updates,
  };
}

describe('iniciarSyncLogRolls', () => {
  let mock: ReturnType<typeof criarClienteMinimo>;
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    useStore.setState(criarEstadoInicial());
    mock = criarClienteMinimo();
    h.clienteAtual = mock;
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    h.clienteAtual = null;
    vi.restoreAllMocks();
  });

  it('entrada de log nova é inserida em log_publico', async () => {
    cleanup = iniciarSyncLogRolls();
    await vi.waitFor(() => expect(useStore.getState().log).toEqual([])); // busca inicial resolvida

    useStore.getState().registrarLog('teste', 'algo aconteceu', null);

    await vi.waitFor(() => expect(mock.inserts.some((i) => i.table === 'log_publico')).toBe(true));
    const inserido = mock.inserts.find((i) => i.table === 'log_publico')!;
    expect(inserido.payload.texto).toBe('algo aconteceu');
    expect(inserido.payload.visibilidade).toBe('publica'); // ausente no client = 'publica' na linha
  });

  it('mudar a visibilidade de uma entrada de log JÁ EXISTENTE dispara update em log_publico, não um novo insert', async () => {
    cleanup = iniciarSyncLogRolls();
    await vi.waitFor(() => expect(useStore.getState().log).toEqual([]));

    useStore.getState().registrarLog('teste', 'vira privado depois', null);
    await vi.waitFor(() => expect(mock.inserts.some((i) => i.table === 'log_publico')).toBe(true));
    const id = useStore.getState().log[0].id;
    mock.inserts.length = 0;

    useStore.getState().definirVisibilidadeLog(id, 'privada');

    await vi.waitFor(() => expect(mock.updates.some((u) => u.table === 'log_publico' && u.id === id)).toBe(true));
    const atualizado = mock.updates.find((u) => u.table === 'log_publico' && u.id === id)!;
    expect(atualizado.payload.visibilidade).toBe('privada');
    expect(mock.inserts.some((i) => i.table === 'log_publico')).toBe(false); // não reinsere
  });

  it('roll novo é inserido em rolls_publicas', async () => {
    cleanup = iniciarSyncLogRolls();
    await vi.waitFor(() => expect(useStore.getState().rollsLog).toEqual([]));

    useStore.getState().registrarRoll({ origem: 'Ana', personagemId: null, formula: '1d20', total: 10, bruto: 10, visibilidade: 'privada' });

    await vi.waitFor(() => expect(mock.inserts.some((i) => i.table === 'rolls_publicas')).toBe(true));
    const inserido = mock.inserts.find((i) => i.table === 'rolls_publicas')!;
    expect(inserido.payload.visibilidade).toBe('privada');
  });

  it('mudar a visibilidade de um roll já existente dispara update em rolls_publicas', async () => {
    cleanup = iniciarSyncLogRolls();
    await vi.waitFor(() => expect(useStore.getState().rollsLog).toEqual([]));

    useStore.getState().registrarRoll({ origem: 'Ana', personagemId: null, formula: '1d20', total: 10, bruto: 10, visibilidade: 'privada' });
    await vi.waitFor(() => expect(mock.inserts.some((i) => i.table === 'rolls_publicas')).toBe(true));
    const id = useStore.getState().rollsLog[0].id;
    mock.inserts.length = 0;

    useStore.getState().definirVisibilidadeRoll(id, 'publica');

    await vi.waitFor(() => expect(mock.updates.some((u) => u.table === 'rolls_publicas' && u.id === id)).toBe(true));
    const atualizado = mock.updates.find((u) => u.table === 'rolls_publicas' && u.id === id)!;
    expect(atualizado.payload.visibilidade).toBe('publica');
  });
});
