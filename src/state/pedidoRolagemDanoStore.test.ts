import { afterEach, describe, expect, it } from 'vitest';
import { usePedidoRolagemDanoStore } from './pedidoRolagemDanoStore';

afterEach(() => {
  usePedidoRolagemDanoStore.setState({ pedido: null });
});

describe('pedidoRolagemDanoStore', () => {
  it('pedirRolagemDano seta o pedido; limparPedidoRolagemDano volta a null', () => {
    const pedido = { id: 'p1', fichaId: 'f1', armaId: 'a1', critico: false, visibilidade: 'publica' as const };
    usePedidoRolagemDanoStore.getState().pedirRolagemDano(pedido);
    expect(usePedidoRolagemDanoStore.getState().pedido).toEqual(pedido);

    usePedidoRolagemDanoStore.getState().limparPedidoRolagemDano();
    expect(usePedidoRolagemDanoStore.getState().pedido).toBeNull();
  });
});
