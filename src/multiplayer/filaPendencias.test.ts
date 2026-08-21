import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStatusMesa } from '../lib/statusMesa';
import {
  executarComRetentativa,
  gravarPendencias,
  instalarRetentativaAutomatica,
  lerPendenciasPersistidas,
  registrarPendencia,
  resolverPendencia,
  retomarPendenciasPersistidas,
  tentarTodasPendencias,
  usePendenciasStore,
} from './filaPendencias';

const criarStorageFalso = (comportamento: { lancaNoSet?: boolean } = {}) => {
  const dados = new Map<string, string>();
  return {
    getItem: vi.fn((chave: string) => dados.get(chave) ?? null),
    setItem: vi.fn((chave: string, valor: string) => {
      if (comportamento.lancaNoSet) throw new DOMException('QuotaExceededError');
      dados.set(chave, valor);
    }),
  };
};

describe('filaPendencias', () => {
  beforeEach(() => {
    usePendenciasStore.setState({ itens: [] });
    useStatusMesa.setState({ local: 'ok', canaisConectados: new Set(), canaisComErro: new Set(), erroRuntime: null });
  });

  describe('registrarPendencia/resolverPendencia', () => {
    it('registrar adiciona à lista, resolver remove', () => {
      registrarPendencia('tokens-sync', 'abc', () => {});
      expect(usePendenciasStore.getState().itens).toEqual([{ modulo: 'tokens-sync', chave: 'abc' }]);
      resolverPendencia('tokens-sync', 'abc');
      expect(usePendenciasStore.getState().itens).toEqual([]);
    });

    it('registrar a mesma chave duas vezes não duplica a entrada', () => {
      registrarPendencia('fow-sync', 'fow', () => {});
      registrarPendencia('fow-sync', 'fow', () => {});
      expect(usePendenciasStore.getState().itens).toHaveLength(1);
    });

    it('resolver uma chave que não estava pendente não lança e não altera a lista', () => {
      expect(() => resolverPendencia('tokens-sync', 'nunca-existiu')).not.toThrow();
      expect(usePendenciasStore.getState().itens).toEqual([]);
    });

    it('chaves de módulos diferentes não colidem', () => {
      registrarPendencia('tokens-sync', 'x', () => {});
      registrarPendencia('fow-sync', 'x', () => {});
      expect(usePendenciasStore.getState().itens).toHaveLength(2);
    });
  });

  describe('retomarPendenciasPersistidas', () => {
    it('devolve só as chaves do módulo pedido', () => {
      registrarPendencia('tokens-sync', 'a', () => {});
      registrarPendencia('tokens-sync', 'b', () => {});
      registrarPendencia('fow-sync', 'fow', () => {});
      expect(retomarPendenciasPersistidas('tokens-sync').sort()).toEqual(['a', 'b']);
      expect(retomarPendenciasPersistidas('fow-sync')).toEqual(['fow']);
      expect(retomarPendenciasPersistidas('outro-modulo')).toEqual([]);
    });
  });

  describe('executarComRetentativa', () => {
    it('sucesso ({error: null}) resolve a pendência sem nunca aparecer na fila', async () => {
      const executar = vi.fn().mockResolvedValue({ error: null });
      executarComRetentativa('tokens-sync', 'abc', executar);
      await vi.waitFor(() => expect(executar).toHaveBeenCalledTimes(1));
      expect(usePendenciasStore.getState().itens).toEqual([]);
    });

    it('erro ({error: algo}) registra a pendência', async () => {
      const executar = vi.fn().mockResolvedValue({ error: new Error('falhou') });
      executarComRetentativa('tokens-sync', 'abc', executar);
      await vi.waitFor(() => expect(usePendenciasStore.getState().itens).toHaveLength(1));
    });

    it('promise rejeitada também registra a pendência (não lança)', async () => {
      const executar = vi.fn().mockRejectedValue(new Error('rede caiu'));
      expect(() => executarComRetentativa('tokens-sync', 'abc', executar)).not.toThrow();
      await vi.waitFor(() => expect(usePendenciasStore.getState().itens).toHaveLength(1));
    });

    it('uma pendência registrada por executarComRetentativa tenta de novo via tentarTodasPendencias', async () => {
      const executar = vi.fn().mockResolvedValueOnce({ error: new Error('falhou') }).mockResolvedValueOnce({ error: null });
      executarComRetentativa('tokens-sync', 'abc', executar);
      await vi.waitFor(() => expect(usePendenciasStore.getState().itens).toHaveLength(1));

      tentarTodasPendencias();
      await vi.waitFor(() => expect(executar).toHaveBeenCalledTimes(2));
      await vi.waitFor(() => expect(usePendenciasStore.getState().itens).toEqual([]));
    });
  });

  describe('instalarRetentativaAutomatica', () => {
    // instalado uma única vez pro describe inteiro (`beforeAll`, não `beforeEach`) — cada
    // chamada assina `useStatusMesa` de novo, e assinaturas não se desfazem entre testes;
    // chamar em cada `it` faria os callbacks dispararem N vezes na Nª transição observada.
    beforeAll(() => {
      expect(() => instalarRetentativaAutomatica()).not.toThrow();
    });

    it('transição de status erro → conectado dispara os callbacks pendentes', () => {
      const callback = vi.fn();
      registrarPendencia('tokens-sync', 'abc', callback);

      useStatusMesa.setState({ canaisComErro: new Set(['tokens-sync']) });
      expect(callback).not.toHaveBeenCalled();

      useStatusMesa.setState({ canaisComErro: new Set(), canaisConectados: new Set(['tokens-sync']) });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('sem transição de erro pra conectado, não dispara nada', () => {
      const callback = vi.fn();
      registrarPendencia('tokens-sync', 'abc', callback);

      useStatusMesa.setState({ canaisConectados: new Set(['outro-canal']) });
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('tentarTodasPendencias', () => {
    it('chama todos os callbacks registrados', () => {
      const a = vi.fn();
      const b = vi.fn();
      registrarPendencia('tokens-sync', 'a', a);
      registrarPendencia('fow-sync', 'fow', b);
      tentarTodasPendencias();
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    });

    it('sem pendências, não lança', () => {
      expect(() => tentarTodasPendencias()).not.toThrow();
    });
  });

  describe('persistência de metadados (lerPendenciasPersistidas/gravarPendencias)', () => {
    it('gravar e depois ler devolve a mesma lista (round-trip através de um "reload" simulado)', () => {
      const storage = criarStorageFalso();
      gravarPendencias(storage, [{ modulo: 'tokens-sync', chave: 'abc' }]);
      expect(lerPendenciasPersistidas(storage)).toEqual([{ modulo: 'tokens-sync', chave: 'abc' }]);
    });

    it('storage vazio devolve lista vazia', () => {
      const storage = criarStorageFalso();
      expect(lerPendenciasPersistidas(storage)).toEqual([]);
    });

    it('JSON corrompido devolve lista vazia em vez de lançar', () => {
      const storage = criarStorageFalso();
      storage.getItem.mockReturnValueOnce('{isso não é json válido');
      expect(() => lerPendenciasPersistidas(storage)).not.toThrow();
      expect(lerPendenciasPersistidas(storage)).toEqual([]);
    });

    it('formato inesperado (não é array de {modulo,chave}) é filtrado, não quebra', () => {
      const storage = criarStorageFalso();
      storage.getItem.mockReturnValueOnce(JSON.stringify([{ modulo: 'x' }, { modulo: 'ok', chave: 'y' }, 'lixo']));
      expect(lerPendenciasPersistidas(storage)).toEqual([{ modulo: 'ok', chave: 'y' }]);
    });

    it('gravarPendencias que lança (quota estourada) não propaga', () => {
      const storage = criarStorageFalso({ lancaNoSet: true });
      expect(() => gravarPendencias(storage, [{ modulo: 'tokens-sync', chave: 'abc' }])).not.toThrow();
    });
  });
});
