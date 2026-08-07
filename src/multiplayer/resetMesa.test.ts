import { beforeEach, describe, expect, it, vi } from 'vitest';
import { criarEstadoInicial, criarFichaVazia, criarNpcVazio } from '../state/factories';
import { useStore } from '../state/store';
import { eraRemocaoExplicita } from './remocaoExplicita';

// `supabase` é exportado como valor (não objeto), então o mock usa um getter pra conseguir
// alternar entre "configurado" e "ausente" entre os testes — o binding ESM é live.
const h = vi.hoisted(() => ({ clienteAtual: null as unknown }));
vi.mock('../lib/supabaseClient', () => ({
  get supabase() {
    return h.clienteAtual;
  },
}));

const { resetarMesaCompleta } = await import('./resetMesa');

function clienteFalso() {
  const not = vi.fn().mockResolvedValue({ error: null });
  const del = vi.fn(() => ({ not }));
  const from = vi.fn(() => ({ delete: del }));
  return { cliente: { from }, from, del, not };
}

/** Estado com um item em cada coleção que o reset precisa apagar no servidor. */
function mesaPovoada() {
  const base = criarEstadoInicial();
  const ficha = { ...criarFichaVazia(), id: 'ficha-1' };
  const npc = { ...criarNpcVazio(), id: 'npc-1' };
  useStore.setState({
    ...base,
    fichas: [ficha],
    npcs: [npc],
    mapa: { ...base.mapa, tokens: [{ id: 'token-1', participanteId: 'ficha-1', tipo: 'pc', x: 0.5, y: 0.5 }] },
    midia: {
      ...base.midia,
      faixas: [{ id: 'faixa-1', nome: 'a.mp3', path: 'm/a.mp3', url: 'https://x/a.mp3', ordem: 0, criadoEm: new Date().toISOString() }],
    },
    soundpad: { ...base.soundpad, sons: [{ id: 'som-1', slot: 0, nome: 'porta', path: 'sfx/porta', url: 'https://x/p' }] },
    log: [{ id: 'log-1', tipo: 'anotacao', texto: 'oi', timestamp: new Date().toISOString(), personagemId: null, visibilidade: 'publica' }],
  });
}

const IDS = ['ficha-1', 'npc-1', 'token-1', 'faixa-1', 'som-1'];

beforeEach(() => {
  useStore.setState(criarEstadoInicial());
  // o Set de remocaoExplicita é module-level e sobrevive entre testes — consome as marcas que
  // um teste anterior deixou pendentes, senão elas vazam pro próximo.
  for (const id of IDS) eraRemocaoExplicita(id);
  h.clienteAtual = null;
  vi.restoreAllMocks();
});

describe('resetarMesaCompleta', () => {
  it('marca remoção explícita de TODAS as coleções antes de resetar — sem isso o sync ignora o sumiço e o dado volta', async () => {
    mesaPovoada();
    const { cliente } = clienteFalso();
    h.clienteAtual = cliente;

    await resetarMesaCompleta();

    // eraRemocaoExplicita consome a marca: true = o sync teria autorização pra propagar o DELETE
    expect(eraRemocaoExplicita('ficha-1')).toBe(true);
    expect(eraRemocaoExplicita('npc-1')).toBe(true);
    expect(eraRemocaoExplicita('token-1')).toBe(true);
    expect(eraRemocaoExplicita('faixa-1')).toBe(true);
    expect(eraRemocaoExplicita('som-1')).toBe(true);
  });

  it('zera o estado local', async () => {
    mesaPovoada();
    h.clienteAtual = clienteFalso().cliente;

    await resetarMesaCompleta();

    const s = useStore.getState();
    expect(s.fichas).toEqual([]);
    expect(s.npcs).toEqual([]);
    expect(s.mapa.tokens).toEqual([]);
    expect(s.log).toEqual([]);
    expect(s.rollsLog).toEqual([]);
  });

  it('apaga rolls_publicas — é a única tabela que nenhum diff de sync cobre', async () => {
    mesaPovoada();
    const { cliente, from, del, not } = clienteFalso();
    h.clienteAtual = cliente;

    await resetarMesaCompleta();

    expect(from).toHaveBeenCalledWith('rolls_publicas');
    expect(del).toHaveBeenCalled();
    // condição sempre-verdadeira que o PostgREST exige pra aceitar delete sem filtro
    expect(not).toHaveBeenCalledWith('id', 'is', null);
  });

  it('sem Supabase configurado: não quebra e ainda reseta local (mesa offline continua usável)', async () => {
    mesaPovoada();
    h.clienteAtual = null;

    await expect(resetarMesaCompleta()).resolves.toBeUndefined();
    expect(useStore.getState().fichas).toEqual([]);
  });

  it('mesa já vazia: não marca nada e continua sem erro', async () => {
    h.clienteAtual = clienteFalso().cliente;

    await resetarMesaCompleta();

    expect(eraRemocaoExplicita('ficha-1')).toBe(false);
    expect(useStore.getState().fichas).toEqual([]);
  });
});
