import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { calcularPvMaximo, calcularSanidadeMaxima, cruzouLinhaDescendo, metade, perdeuCincoOuMaisDeUmaVez } from '../rules/derivados';
import { calcularExpiraSurto } from '../rules/surto';
import { ordenarIniciativa } from '../rules/teste';
import {
  COR_NPC_PADRAO,
  criarEstadoInicial,
  criarFichaVazia,
  criarGradeInicial,
  criarNpcVazio,
  criarSessaoPrivada,
  criarSessaoPublica,
  SCHEMA_VERSION,
} from './factories';
import type {
  EntradaIniciativa,
  EntradaLog,
  EstadoGlobal,
  EstadoMapa,
  Ficha,
  GradeMapa,
  Npc,
  SessaoPrivada,
  SessaoPublica,
  TipoLog,
  TokenMapa,
} from './types';

/** tipos de log que representam uma rolagem de dado — conta pra `estatisticas.rolagens`. */
const TIPOS_ROLAGEM: TipoLog[] = ['teste', 'rolagem-livre', 'surto', 'iniciativa'];

export interface AlertaSanidade {
  cruzouLinhaSanidade: boolean;
  surtoDisparado: boolean;
}

/** Estado efêmero de UI — não faz parte de `EstadoGlobal` (não entra no export/import). */
interface EstadoEfemero {
  /** timestamp do último burst do sistema de ruído — dispara em qualquer queda de Sanidade e ao
   *  rolar na tabela de Surto; RuidoOverlay observa isso pro burst de 1,5s (arte.md). */
  ultimoBurstRuidoEm: number | null;
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

  /** Rola iniciativa se ainda não houver, e liga o modo combate na 1ª entrada da ordem. */
  iniciarModoCombate: () => void;
  /** Passa pro próximo em `iniciativa`; dá a volta soma 1 em `rodada`. */
  avancarTurno: () => void;
  /** Só para de checar a trava — não zera `iniciativa`/`rodada` (mesa-estatica-multiplayer-completo.md Parte I §6.3). */
  encerrarModoCombate: () => void;

  atualizarMapa: (patch: Partial<EstadoMapa>) => void;
  atualizarGrade: (patch: Partial<GradeMapa>) => void;
  /** Ignora se o participante já tem token no mapa (evita duplicar ao clicar 2x). */
  adicionarTokenMapa: (participanteId: string, tipo: 'pc' | 'npc') => void;
  moverTokenMapa: (id: string, x: number, y: number) => void;
  removerTokenMapa: (id: string) => void;

  registrarLog: (tipo: TipoLog, texto: string, personagemId?: string | null) => void;
  limparLog: () => void;

  atualizarSessaoPublica: (patch: Partial<SessaoPublica>) => void;
  atualizarSessaoPrivada: (patch: Partial<SessaoPrivada>) => void;
  /** incrementa o contador de cena (usado pelo Surto — ver mesa-estatica-multiplayer-completo.md Parte II §2). */
  avancarCena: () => void;

  adicionarEvento: (texto: string) => void;
  alternarEvento: (id: string) => void;
  removerEvento: (id: string) => void;

  adicionarLembrete: (texto: string) => void;
  removerLembrete: (id: string) => void;

  /** Clampa em >= 0. Sem gatilho automático — não há regra de morte em regras.md. */
  ajustarMortes: (delta: number) => void;
  iniciarSessaoTimer: () => void;
  encerrarSessaoTimer: () => void;

  atualizarConfig: (patch: Partial<EstadoGlobal['config']>) => void;

  /** Dispara o burst de 1,5s do sistema de ruído (arte.md) — queda de Sanidade e rolagem de Surto. */
  dispararBurstRuido: () => void;

  exportarJSON: () => string;
  importarJSON: (json: string) => void;
  resetarEstado: () => void;
}

type Store = EstadoGlobal & Acoes & EstadoEfemero;

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...criarEstadoInicial(),
      ultimoBurstRuidoEm: null,

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
        set((s) => ({
          fichas: s.fichas.map((f) =>
            f.id === id
              ? {
                  ...f,
                  sanidadeAtual: valor,
                  // marca o Surto até o fim da cena atual — avançar cena invalida sozinho
                  // (comparação por número, não precisa limpar ficha por ficha depois).
                  surtoAtivo: alerta.surtoDisparado ? calcularExpiraSurto(s.sessaoPublica) : f.surtoAtivo,
                }
              : f,
          ),
        }));
        get().registrarLog(
          'sanidade',
          `${ficha.nome || 'Personagem'}: Sanidade ${delta > 0 ? '+' : ''}${delta} (${anterior} → ${valor})`,
          id,
        );
        // qualquer queda de Sanidade acende o burst do ruído, não só o Surto — reação instantânea.
        if (delta < 0) get().dispararBurstRuido();
        if (alerta.surtoDisparado) {
          set((s) => ({
            sessaoPrivada: {
              ...s.sessaoPrivada,
              estatisticas: { ...s.sessaoPrivada.estatisticas, surtos: s.sessaoPrivada.estatisticas.surtos + 1 },
            },
          }));
        }
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

      iniciarModoCombate: () => {
        if (get().iniciativa.length === 0) get().rolarIniciativaTodos();
        if (get().iniciativa.length === 0) return; // ninguém pra lutar — não liga o modo.
        set((s) => ({
          sessaoPublica: { ...s.sessaoPublica, modoCombate: true, indiceAtualTurno: 0, rodada: 1 },
        }));
      },
      avancarTurno: () =>
        set((s) => {
          const total = s.iniciativa.length;
          if (total === 0) return s;
          const proximo = (s.sessaoPublica.indiceAtualTurno + 1) % total;
          const rodada = proximo === 0 ? s.sessaoPublica.rodada + 1 : s.sessaoPublica.rodada;
          return { sessaoPublica: { ...s.sessaoPublica, indiceAtualTurno: proximo, rodada } };
        }),
      encerrarModoCombate: () => set((s) => ({ sessaoPublica: { ...s.sessaoPublica, modoCombate: false } })),

      atualizarMapa: (patch) => set((s) => ({ mapa: { ...s.mapa, ...patch } })),
      atualizarGrade: (patch) => set((s) => ({ mapa: { ...s.mapa, grade: { ...s.mapa.grade, ...patch } } })),
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
        if (TIPOS_ROLAGEM.includes(tipo)) {
          set((s) => ({
            sessaoPrivada: {
              ...s.sessaoPrivada,
              estatisticas: { ...s.sessaoPrivada.estatisticas, rolagens: s.sessaoPrivada.estatisticas.rolagens + 1 },
            },
          }));
        }
      },
      limparLog: () =>
        set((s) => ({
          log: [],
          sessaoPrivada: {
            ...s.sessaoPrivada,
            estatisticas: { ...s.sessaoPrivada.estatisticas, rolagens: 0 },
          },
        })),

      atualizarSessaoPublica: (patch) => set((s) => ({ sessaoPublica: { ...s.sessaoPublica, ...patch } })),
      atualizarSessaoPrivada: (patch) => set((s) => ({ sessaoPrivada: { ...s.sessaoPrivada, ...patch } })),
      avancarCena: () =>
        set((s) => ({ sessaoPublica: { ...s.sessaoPublica, contadorCena: s.sessaoPublica.contadorCena + 1 } })),

      adicionarEvento: (texto) =>
        set((s) => ({
          sessaoPrivada: {
            ...s.sessaoPrivada,
            eventos: [...s.sessaoPrivada.eventos, { id: crypto.randomUUID(), texto, feito: false }],
          },
        })),
      alternarEvento: (id) =>
        set((s) => ({
          sessaoPrivada: {
            ...s.sessaoPrivada,
            eventos: s.sessaoPrivada.eventos.map((e) => (e.id === id ? { ...e, feito: !e.feito } : e)),
          },
        })),
      removerEvento: (id) =>
        set((s) => ({
          sessaoPrivada: { ...s.sessaoPrivada, eventos: s.sessaoPrivada.eventos.filter((e) => e.id !== id) },
        })),

      adicionarLembrete: (texto) =>
        set((s) => ({
          sessaoPrivada: {
            ...s.sessaoPrivada,
            lembretes: [...s.sessaoPrivada.lembretes, { id: crypto.randomUUID(), texto }],
          },
        })),
      removerLembrete: (id) =>
        set((s) => ({
          sessaoPrivada: { ...s.sessaoPrivada, lembretes: s.sessaoPrivada.lembretes.filter((l) => l.id !== id) },
        })),

      ajustarMortes: (delta) =>
        set((s) => ({
          sessaoPrivada: {
            ...s.sessaoPrivada,
            estatisticas: {
              ...s.sessaoPrivada.estatisticas,
              mortes: Math.max(0, s.sessaoPrivada.estatisticas.mortes + delta),
            },
          },
        })),
      iniciarSessaoTimer: () =>
        set((s) =>
          s.sessaoPrivada.estatisticas.iniciadaEm
            ? s
            : {
                sessaoPrivada: {
                  ...s.sessaoPrivada,
                  estatisticas: { ...s.sessaoPrivada.estatisticas, iniciadaEm: new Date().toISOString() },
                },
              },
        ),
      encerrarSessaoTimer: () =>
        set((s) => ({
          sessaoPrivada: { ...s.sessaoPrivada, estatisticas: { ...s.sessaoPrivada.estatisticas, iniciadaEm: null } },
        })),

      atualizarConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),

      dispararBurstRuido: () => set({ ultimoBurstRuidoEm: Date.now() }),

      exportarJSON: () => {
        const { fichas, fichaAtivaId, npcs, iniciativa, mapa, log, config, sessaoPublica, sessaoPrivada, schemaVersion } =
          get();
        return JSON.stringify(
          { schemaVersion, sessaoPublica, sessaoPrivada, fichas, fichaAtivaId, npcs, iniciativa, mapa, log, config },
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
      migrate: (persistedState, versaoAnterior) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const estado = persistedState as any;
        // v1 → v2: mapa não tinha `grade` (grid customizável da aba Mapa).
        if (versaoAnterior < 2 && estado.mapa && !estado.mapa.grade) {
          estado.mapa = { ...estado.mapa, grade: criarGradeInicial() };
        }
        // v2 → v3: `sessao` (único objeto) vira `sessaoPublica`/`sessaoPrivada` separados
        // (mesa-estatica-multiplayer-completo.md Parte III §0 — prepara pro Supabase futuro).
        if (versaoAnterior < 3 && estado.sessao) {
          const antiga = estado.sessao;
          estado.sessaoPublica = {
            ...criarSessaoPublica(),
            nomeDaMesa: antiga.nomeDaMesa,
            numeroSessao: antiga.numeroSessao,
            clima: antiga.clima,
            hora: antiga.hora,
            cenaAtual: antiga.cenaAtual,
          };
          estado.sessaoPrivada = criarSessaoPrivada();
          delete estado.sessao;
        }
        // v3 → v4: cor de NPC editável, marcador de Surto até fim de cena, modo combate por
        // turnos (mesa-estatica-multiplayer-completo.md Parte II §1-4).
        if (versaoAnterior < 4) {
          if (estado.npcs) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            estado.npcs = estado.npcs.map((n: any) => ({ corVisual: COR_NPC_PADRAO, ...n }));
          }
          if (estado.fichas) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            estado.fichas = estado.fichas.map((f: any) => ({ surtoAtivo: null, ...f }));
          }
          if (estado.sessaoPublica) {
            estado.sessaoPublica = {
              modoCombate: false,
              indiceAtualTurno: 0,
              rodada: 1,
              ...estado.sessaoPublica,
            };
          }
        }
        return estado as Store;
      },
    },
  ),
);
