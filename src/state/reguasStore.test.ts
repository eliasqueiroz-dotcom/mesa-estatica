import { beforeEach, describe, expect, it } from 'vitest';
import { useReguasStore, type ReguaViva } from './reguasStore';

const criarRegua = (overrides: Partial<ReguaViva> = {}): ReguaViva => ({
  id: 'ficha-1',
  autorId: 'ficha-1',
  cor: '#4fc1d4',
  pontos: [{ x: 0.1, y: 0.1 }],
  atualizadaEm: Date.now(),
  ativa: true,
  ...overrides,
});

beforeEach(() => {
  useReguasStore.setState({ reguas: {} });
});

describe('upsertRegua', () => {
  it('adiciona uma régua nova', () => {
    useReguasStore.getState().upsertRegua(criarRegua());
    expect(Object.keys(useReguasStore.getState().reguas)).toEqual(['ficha-1']);
  });

  it('substitui a régua existente do mesmo autor em vez de acumular', () => {
    useReguasStore.getState().upsertRegua(criarRegua({ pontos: [{ x: 0, y: 0 }] }));
    useReguasStore.getState().upsertRegua(criarRegua({ pontos: [{ x: 0.5, y: 0.5 }] }));
    const reguas = useReguasStore.getState().reguas;
    expect(Object.keys(reguas)).toHaveLength(1);
    expect(reguas['ficha-1'].pontos).toEqual([{ x: 0.5, y: 0.5 }]);
  });

  it('duas réguas de autores diferentes coexistem', () => {
    useReguasStore.getState().upsertRegua(criarRegua({ id: 'ficha-1', autorId: 'ficha-1' }));
    useReguasStore.getState().upsertRegua(criarRegua({ id: 'mestre', autorId: 'mestre', cor: 'var(--rede)' }));
    expect(Object.keys(useReguasStore.getState().reguas)).toEqual(['ficha-1', 'mestre']);
  });
});

describe('removerRegua', () => {
  it('remove pelo id', () => {
    useReguasStore.getState().upsertRegua(criarRegua());
    useReguasStore.getState().removerRegua('ficha-1');
    expect(useReguasStore.getState().reguas).toEqual({});
  });

  it('remover id inexistente não quebra', () => {
    expect(() => useReguasStore.getState().removerRegua('nao-existe')).not.toThrow();
  });
});

describe('expirarAntigas', () => {
  it('remove régua inativa além do limiar', () => {
    const agora = 10_000;
    useReguasStore.getState().upsertRegua(criarRegua({ ativa: false, atualizadaEm: 5_000 }));
    useReguasStore.getState().expirarAntigas(agora, 4_000);
    expect(useReguasStore.getState().reguas).toEqual({});
  });

  it('mantém régua inativa ainda dentro do limiar', () => {
    const agora = 10_000;
    useReguasStore.getState().upsertRegua(criarRegua({ ativa: false, atualizadaEm: 8_000 }));
    useReguasStore.getState().expirarAntigas(agora, 4_000);
    expect(Object.keys(useReguasStore.getState().reguas)).toEqual(['ficha-1']);
  });

  it('régua ATIVA não expira pelo limiar normal, mesmo muito além dele (sem rede de segurança)', () => {
    const agora = 100_000;
    useReguasStore.getState().upsertRegua(criarRegua({ ativa: true, atualizadaEm: 0 }));
    useReguasStore.getState().expirarAntigas(agora, 4_000);
    expect(Object.keys(useReguasStore.getState().reguas)).toEqual(['ficha-1']);
  });

  it('régua ATIVA expira pela rede de segurança quando ultrapassa limiarAtivaSemAtualizarMs', () => {
    const agora = 100_000;
    useReguasStore.getState().upsertRegua(criarRegua({ ativa: true, atualizadaEm: 0 }));
    useReguasStore.getState().expirarAntigas(agora, 4_000, 6_000);
    expect(useReguasStore.getState().reguas).toEqual({});
  });

  it('régua ATIVA recém-atualizada não expira pela rede de segurança', () => {
    const agora = 10_000;
    useReguasStore.getState().upsertRegua(criarRegua({ ativa: true, atualizadaEm: 9_000 }));
    useReguasStore.getState().expirarAntigas(agora, 4_000, 6_000);
    expect(Object.keys(useReguasStore.getState().reguas)).toEqual(['ficha-1']);
  });

  it('sem réguas expiradas, não muda a referência do objeto (evita rerender à toa)', () => {
    useReguasStore.getState().upsertRegua(criarRegua({ ativa: true, atualizadaEm: 0 }));
    const antes = useReguasStore.getState().reguas;
    useReguasStore.getState().expirarAntigas(100_000, 4_000);
    expect(useReguasStore.getState().reguas).toBe(antes);
  });
});
