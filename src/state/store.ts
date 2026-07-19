import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { calcularPvMaximo, calcularSanidadeMaxima, cruzouLinhaDescendo, metade, perdeuCincoOuMaisDeUmaVez } from '../rules/derivados';
import { criarEstadoInicial, criarFichaVazia, criarNpcVazio, SCHEMA_VERSION } from './factories';
import type { EntradaLog, EstadoGlobal, Ficha, Npc, TipoLog } from './types';

export interface AlertaSanidade {
  cruzouLinhaSanidade: boolean;
  surtoDisparado: boolean;
}

interface Acoes {
  adicionarFicha: () => string;
  atualizarFicha: (id: string, patch: Partial<Ficha>) => void;
  removerFicha: (id: string) => void;
  definirFichaAtiva: (id: string | null) => void;

  /** Clampa em [0, máximo], loga o delta no log da sessão. */
  ajustarPvAtual: (id: string, novoValor: number) => void;
  /** Igual ao PV, mas também detecta cruzamento da linha (→ Trauma) e perda ≥5 de uma vez (→ Surto). */
  ajustarSanidadeAtual: (id: string, novoValor: number) => AlertaSanidade;
  ajustarDeterminacao: (id: string, novoValor: number) => void;
  ajustarDinheiro: (id: string, tipo: 'real' | 'ponto', novoValor: number) => void;

  adicionarNpc: () => string;
  atualizarNpc: (id: string, patch: Partial<Npc>) => void;
  removerNpc: (id: string) => void;

  registrarLog: (tipo: TipoLog, texto: string, personagemId?: string | null) => void;
  limparLog: () => void;

  atualizarSessao: (patch: Partial<EstadoGlobal['sessao']>) => void;
  atualizarConfig: (patch: Partial<EstadoGlobal['config']>) => void;

  exportarJSON: () => string;
  importarJSON: (json: string) => void;
  resetarEstado: () => void;
}

type Store = EstadoGlobal & Acoes;

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...criarEstadoInicial(),

      adicionarFicha: () => {
        const ficha = criarFichaVazia(get().fichas.length);
        set((s) => ({ fichas: [...s.fichas, ficha], fichaAtivaId: s.fichaAtivaId ?? ficha.id }));
        return ficha.id;
      },
      atualizarFicha: (id, patch) =>
        set((s) => ({
          fichas: s.fichas.map((f) => (f.id === id ? { ...f, ...patch } : f)),
        })),
      removerFicha: (id) =>
        set((s) => ({
          fichas: s.fichas.filter((f) => f.id !== id),
          fichaAtivaId: s.fichaAtivaId === id ? null : s.fichaAtivaId,
        })),
      definirFichaAtiva: (id) => set({ fichaAtivaId: id }),

      ajustarPvAtual: (id, novoValor) => {
        const ficha = get().fichas.find((f) => f.id === id);
        if (!ficha) return;
        const pvMaximo = calcularPvMaximo(get().config.basePV, ficha.atributos.vigor);
        const valor = Math.max(0, Math.min(novoValor, pvMaximo));
        const delta = valor - ficha.pvAtual;
        if (delta === 0) return;
        set((s) => ({ fichas: s.fichas.map((f) => (f.id === id ? { ...f, pvAtual: valor } : f)) }));
        get().registrarLog(
          delta > 0 ? 'cura' : 'dano',
          `${ficha.nome || 'Personagem'}: PV ${delta > 0 ? '+' : ''}${delta} (${ficha.pvAtual} → ${valor})`,
          id,
        );
      },

      ajustarSanidadeAtual: (id, novoValor) => {
        const ficha = get().fichas.find((f) => f.id === id);
        if (!ficha) return { cruzouLinhaSanidade: false, surtoDisparado: false };
        const sanidadeMaxima = calcularSanidadeMaxima(ficha.atributos.vontade);
        const valor = Math.max(0, Math.min(novoValor, sanidadeMaxima));
        const anterior = ficha.sanidadeAtual;
        const delta = valor - anterior;
        if (delta === 0) return { cruzouLinhaSanidade: false, surtoDisparado: false };
        const linha = metade(sanidadeMaxima);
        const alerta: AlertaSanidade = {
          cruzouLinhaSanidade: cruzouLinhaDescendo(anterior, valor, linha),
          surtoDisparado: perdeuCincoOuMaisDeUmaVez(anterior, valor),
        };
        set((s) => ({ fichas: s.fichas.map((f) => (f.id === id ? { ...f, sanidadeAtual: valor } : f)) }));
        get().registrarLog(
          'sanidade',
          `${ficha.nome || 'Personagem'}: Sanidade ${delta > 0 ? '+' : ''}${delta} (${anterior} → ${valor})`,
          id,
        );
        return alerta;
      },

      ajustarDeterminacao: (id, novoValor) => {
        const ficha = get().fichas.find((f) => f.id === id);
        if (!ficha) return;
        const valor = Math.max(0, Math.min(novoValor, 2));
        if (valor === ficha.determinacao) return;
        set((s) => ({ fichas: s.fichas.map((f) => (f.id === id ? { ...f, determinacao: valor } : f)) }));
        get().registrarLog('determinacao', `${ficha.nome || 'Personagem'}: Determinação → ${valor}`, id);
      },

      ajustarDinheiro: (id, tipo, novoValor) => {
        const ficha = get().fichas.find((f) => f.id === id);
        if (!ficha) return;
        const campo = tipo === 'real' ? 'dinheiroReal' : 'dinheiroPonto';
        const anterior = ficha[campo];
        const valor = Math.max(0, novoValor);
        const delta = valor - anterior;
        if (delta === 0) return;
        set((s) => ({ fichas: s.fichas.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)) }));
        const simbolo = tipo === 'real' ? 'R$' : 'P$';
        get().registrarLog(
          'dinheiro',
          `${ficha.nome || 'Personagem'}: ${simbolo} ${delta > 0 ? '+' : ''}${delta} (${anterior} → ${valor})`,
          id,
        );
      },

      adicionarNpc: () => {
        const npc = criarNpcVazio();
        set((s) => ({ npcs: [...s.npcs, npc] }));
        return npc.id;
      },
      atualizarNpc: (id, patch) =>
        set((s) => ({ npcs: s.npcs.map((n) => (n.id === id ? { ...n, ...patch } : n)) })),
      removerNpc: (id) => set((s) => ({ npcs: s.npcs.filter((n) => n.id !== id) })),

      registrarLog: (tipo, texto, personagemId = null) => {
        const entrada: EntradaLog = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          tipo,
          personagemId,
          texto,
        };
        set((s) => ({ log: [entrada, ...s.log] }));
      },
      limparLog: () => set({ log: [] }),

      atualizarSessao: (patch) => set((s) => ({ sessao: { ...s.sessao, ...patch } })),
      atualizarConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),

      exportarJSON: () => {
        const { fichas, fichaAtivaId, npcs, iniciativa, mapa, log, config, sessao, schemaVersion } = get();
        return JSON.stringify(
          { schemaVersion, sessao, fichas, fichaAtivaId, npcs, iniciativa, mapa, log, config },
          null,
          2,
        );
      },
      importarJSON: (json) => {
        const dados = JSON.parse(json) as EstadoGlobal;
        set({ ...dados });
      },
      resetarEstado: () => set(criarEstadoInicial()),
    }),
    {
      name: 'estatica-mesa',
      version: SCHEMA_VERSION,
      migrate: (persistedState) => persistedState as Store,
    },
  ),
);
