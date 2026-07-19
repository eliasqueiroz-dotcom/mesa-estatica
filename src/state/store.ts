import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { calcularPvMaximo, calcularSanidadeMaxima, cruzouLinhaDescendo, metade, perdeuCincoOuMaisDeUmaVez } from '../rules/derivados';
import { ordenarIniciativa } from '../rules/teste';
import { criarEstadoInicial, criarFichaVazia, criarNpcVazio, SCHEMA_VERSION } from './factories';
import type { EntradaIniciativa, EntradaLog, EstadoGlobal, EstadoMapa, Ficha, Npc, TipoLog, TokenMapa } from './types';

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

  /** Rola d20+Agilidade pra cada ficha e cada NPC, ordena e substitui a tabela de iniciativa. */
  rolarIniciativaTodos: () => void;
  removerDaIniciativa: (id: string) => void;
  limparIniciativa: () => void;

  atualizarMapa: (patch: Partial<EstadoMapa>) => void;
  /** Ignora se o participante já tem token no mapa (evita duplicar ao clicar 2x). */
  adicionarTokenMapa: (participanteId: string, tipo: 'pc' | 'npc') => void;
  moverTokenMapa: (id: string, x: number, y: number) => void;
  removerTokenMapa: (id: string) => void;

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

      rolarIniciativaTodos: () => {
        const { fichas, npcs } = get();
        const d20 = () => Math.floor(Math.random() * 20) + 1;
        const participantes = [
          ...fichas.map((f) => ({
            id: f.id,
            tipo: 'pc' as const,
            nome: f.nome || 'sem nome',
            d20: d20(),
            agilidade: f.atributos.agilidade,
          })),
          ...npcs.map((n) => ({
            id: n.id,
            tipo: 'npc' as const,
            nome: n.nome || 'sem nome',
            d20: d20(),
            agilidade: n.agilidade,
          })),
        ];
        if (participantes.length === 0) return;
        const ordenados = ordenarIniciativa(participantes);
        const entradas: EntradaIniciativa[] = ordenados.map((p) => ({
          id: crypto.randomUUID(),
          participanteId: p.id,
          tipo: p.tipo,
          nome: p.nome,
          valor: p.d20 + p.agilidade,
        }));
        set({ iniciativa: entradas });
        get().registrarLog(
          'iniciativa',
          `iniciativa rolada — ${entradas.map((e) => `${e.nome} ${e.valor}`).join(', ')}`,
        );
      },
      removerDaIniciativa: (id) => set((s) => ({ iniciativa: s.iniciativa.filter((e) => e.id !== id) })),
      limparIniciativa: () => set({ iniciativa: [] }),

      atualizarMapa: (patch) => set((s) => ({ mapa: { ...s.mapa, ...patch } })),
      adicionarTokenMapa: (participanteId, tipo) =>
        set((s) => {
          if (s.mapa.tokens.some((t) => t.participanteId === participanteId)) return s;
          const token: TokenMapa = { id: crypto.randomUUID(), participanteId, tipo, x: 0.5, y: 0.5 };
          return { mapa: { ...s.mapa, tokens: [...s.mapa.tokens, token] } };
        }),
      moverTokenMapa: (id, x, y) =>
        set((s) => ({
          mapa: {
            ...s.mapa,
            tokens: s.mapa.tokens.map((t) =>
              t.id === id ? { ...t, x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) } : t,
            ),
          },
        })),
      removerTokenMapa: (id) =>
        set((s) => ({ mapa: { ...s.mapa, tokens: s.mapa.tokens.filter((t) => t.id !== id) } })),

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
