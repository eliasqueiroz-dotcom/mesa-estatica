import { beforeEach, describe, expect, it } from 'vitest';
import { useCombateUiStore } from './combateUiStore';

const estadoInicial = useCombateUiStore.getState();

beforeEach(() => {
  useCombateUiStore.setState(estadoInicial, true);
});

describe('useCombateUiStore', () => {
  it('é um único store compartilhado — duas leituras veem a mesma seleção (o bug que motivou tirar isso de useState local)', () => {
    useCombateUiStore.getState().toggleSelecionadoAplicar('npc-1');
    // simula um segundo painel montado ao mesmo tempo (NpcsTab + CombatOverlay), lendo o
    // mesmo store em vez de uma cópia local via useState
    const leituraDoOutroPainel = useCombateUiStore.getState().selecionadosAplicar;
    expect(leituraDoOutroPainel.has('npc-1')).toBe(true);
  });

  it('toggleSelecionadoAplicar liga e desliga', () => {
    useCombateUiStore.getState().toggleSelecionadoAplicar('a');
    expect(useCombateUiStore.getState().selecionadosAplicar.has('a')).toBe(true);
    useCombateUiStore.getState().toggleSelecionadoAplicar('a');
    expect(useCombateUiStore.getState().selecionadosAplicar.has('a')).toBe(false);
  });

  it('limparSelecaoAplicar esvazia a seleção', () => {
    useCombateUiStore.getState().toggleSelecionadoAplicar('a');
    useCombateUiStore.getState().toggleSelecionadoAplicar('b');
    useCombateUiStore.getState().limparSelecaoAplicar();
    expect(useCombateUiStore.getState().selecionadosAplicar.size).toBe(0);
  });

  it('setAgruparNpcs é compartilhado entre painéis', () => {
    useCombateUiStore.getState().setAgruparNpcs(true);
    expect(useCombateUiStore.getState().agruparNpcs).toBe(true);
  });

  it('definirSocorrista guarda por alvo, sem apagar outros alvos já definidos', () => {
    useCombateUiStore.getState().definirSocorrista('alvo-1', 'ficha-a');
    useCombateUiStore.getState().definirSocorrista('alvo-2', 'ficha-b');
    expect(useCombateUiStore.getState().socorristaPorAlvo).toEqual({ 'alvo-1': 'ficha-a', 'alvo-2': 'ficha-b' });
  });
});
