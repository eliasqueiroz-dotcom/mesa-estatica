import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { criarEstadoInicial, criarFichaVazia, criarNpcVazio, SCHEMA_VERSION } from './factories';
import type { EntradaLog, EstadoGlobal, Ficha, Npc, TipoLog } from './types';

interface Acoes {
  adicionarFicha: () => string;
  atualizarFicha: (id: string, patch: Partial<Ficha>) => void;
  removerFicha: (id: string) => void;
  definirFichaAtiva: (id: string | null) => void;

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
