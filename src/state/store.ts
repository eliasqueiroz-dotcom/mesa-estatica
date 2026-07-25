import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { calcularPvMaximo, calcularSanidadeMaxima, cruzouLinhaDescendo, metade, perdeuCincoOuMaisDeUmaVez } from '../rules/derivados';
import { resolverSurto } from '../rules/surto';
import type { EscolhaSurtoPendente } from './types';
import { ordenarIniciativa } from '../rules/teste';
import {
  COR_NPC_PADRAO,
  criarEstadoInicial,
  criarEstadoMidia,
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
  EntradaRoll,
  EstadoGlobal,
  EstadoMapa,
  EstadoMidia,
  FaixaMidia,
  Ficha,
  GradeMapa,
  Npc,
  SessaoPrivada,
  SessaoPublica,
  SurtoAtivo,
  TipoLog,
  TokenMapa,
} from './types';

const ATRIBUTOS_ZERO: Record<'vigor' | 'agilidade' | 'intelecto' | 'percepcao' | 'presenca' | 'vontade', number> = {
  vigor: 0,
  agilidade: 0,
  intelecto: 0,
  percepcao: 0,
  presenca: 0,
  vontade: 0,
};

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
  /** quando um Surto dispara com os dois d20 diferentes, fica pendente até o mestre escolher
   *  qual entrada vigora (regras.md: "o jogador escolhe qual acontece") — chaveado por fichaId. */
  escolhasSurtoPendentes: Record<string, EscolhaSurtoPendente>;
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
  /** Resolve a escolha pendente de um personagem (dois d20 diferentes) com o lado que o mestre escolheu. */
  resolverEscolhaSurtoPendente: (fichaId: string, lado: 'A' | 'B') => void;
  ajustarDeterminacao: (id: string, novoValor: number) => void;
  ajustarDinheiro: (id: string, tipo: 'real' | 'ponto', novoValor: number) => void;
  /** Câmbio entre R$/P$ (regras.md "grana e equipamento") — P$→R$ com cambista desconta 30%;
   *  R$→P$ é 1:1 mas exige justificar origem (mestre decide, a UI só avisa). Debita no máximo o
   *  saldo disponível na moeda de origem. Loga uma única entrada 'dinheiro' com as duas pernas. */
  converterDinheiro: (id: string, direcao: 'realParaPonto' | 'pontoParaReal', valor: number) => void;

  adicionarNpc: () => string;
  atualizarNpc: (id: string, patch: Partial<Npc>) => void;
  removerNpc: (id: string) => void;
  duplicarNpc: (id: string) => void;

  /** Rola d20+Agilidade pra cada ficha e cada NPC, ordena e substitui a tabela de iniciativa. */
  rolarIniciativaTodos: () => void;
  /** Rola iniciativa apenas para os IDs de participante selecionados (PC ou NPC). */
  rolarIniciativa: (participanteIds: string[]) => void;
  removerDaIniciativa: (id: string) => void;
  limparIniciativa: () => void;
  /** Reordena a lista de iniciativa (drag-and-drop). Ajusta `indiceAtualTurno` se o turno atual for movido. */
  reordenarIniciativa: (de: number, para: number) => void;

  /** Rola iniciativa se ainda não houver, e liga o modo combate na 1ª entrada da ordem. */
  iniciarModoCombate: () => void;
  /** Passa pro próximo em `iniciativa`; dá a volta soma 1 em `rodada`. */
  avancarTurno: () => void;
  /** Só para de checar a trava — não zera `iniciativa`/`rodada` (mesa-estatica-multiplayer-completo.md Parte I §6.3); limpa `condicoesCombate`. */
  encerrarModoCombate: () => void;
  /** Liga/desliga uma condição de combate (`CONDICOES_COMBATE`) num combatente. */
  alternarCondicaoCombate: (participanteId: string, condicaoId: string) => void;

  atualizarMapa: (patch: Partial<EstadoMapa>) => void;
  atualizarGrade: (patch: Partial<GradeMapa>) => void;
  /** Ignora se o participante já tem token no mapa (evita duplicar ao clicar 2x). */
  adicionarTokenMapa: (participanteId: string, tipo: 'pc' | 'npc') => void;
  moverTokenMapa: (id: string, x: number, y: number) => void;
  removerTokenMapa: (id: string) => void;

  /** Ordem = maior ordem atual + 1. Retorna o id gerado. */
  adicionarFaixaMidia: (nome: string, path: string, url: string) => string;
  removerFaixaMidia: (id: string) => void;
  /** Troca `ordem` com o vizinho imediato na lista ordenada; no-op nas bordas. */
  moverFaixaMidia: (id: string, direcao: 'cima' | 'baixo') => void;
  /** Patch genérico de playback — sempre recarimba `atualizadoEm`. Todo transporte
   *  (play/pause/seek/próxima/anterior/loop/fim-de-faixa) passa por aqui. */
  atualizarEstadoMidia: (
    patch: Partial<Pick<EstadoMidia, 'faixaAtualId' | 'tocando' | 'posicaoSegundos' | 'modoLoop'>>,
  ) => void;

  registrarLog: (tipo: TipoLog, texto: string, personagemId?: string | null) => void;
  limparLog: () => void;

  registrarRoll: (entrada: Omit<EntradaRoll, 'id' | 'timestamp'>) => void;
  revelarRoll: (id: string) => void;

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

/** Sem-op — usado no bundle do jogador (ver `ehBundleJogador` abaixo). `localStorage`
 *  nunca é a origem no cliente do jogador (mesa-estatica-multiplayer-completo.md Parte IV
 *  §4): sem isso, o `useStore` compartilhado (reusado por `FichaEditor`/`*View` nos dois
 *  bundles) rehidrataria do MESMO localStorage do `GmApp` sempre que os dois rodarem na
 *  mesma origem — inofensivo em dispositivos separados, mas ainda assim persistiria estado
 *  do jogador em disco, contra o que a Parte IV pede. */
const semPersistencia: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

/** `jogador.html`/`entries/jogador.tsx` (ver vite.config.ts) — checado por pathname porque
 *  a decisão precisa existir antes de qualquer import estático rodar (ordem de avaliação de
 *  módulos ES não garante que um "flag" setado em código no topo de jogador.tsx rode antes
 *  das dependências transitivas de PlayerApp, que incluem este arquivo). */
const ehBundleJogador = typeof window !== 'undefined' && window.location.pathname.includes('jogador.html');

/** `localStorage.setItem` do estado inteiro rodava em CADA `set()` — uma tecla digitada
 *  numa ficha, um `pointermove` arrastando um token no mapa, cada um serializando e gravando
 *  a mesa inteira em disco. Debounça só a ESCRITA (a atualização local do Zustand continua
 *  instantânea — teclar/arrastar não fica menos responsivo); grava a última versão até
 *  `ATRASO_STORAGE_MS` depois da última mudança. `pagehide`/`visibilitychange` forçam a
 *  gravação pendente antes de fechar a aba — sem isso, a última tecla digitada bem antes de
 *  fechar podia nunca chegar no disco. */
const ATRASO_STORAGE_MS = 400;

function criarStorageComDebounce(bruto: Storage): StateStorage {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendente: { chave: string; valor: string } | null = null;

  const gravarAgora = () => {
    if (!pendente) return;
    bruto.setItem(pendente.chave, pendente.valor);
    pendente = null;
    if (timer) clearTimeout(timer);
    timer = null;
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', gravarAgora);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') gravarAgora();
    });
  }

  return {
    getItem: (chave) => bruto.getItem(chave),
    removeItem: (chave) => bruto.removeItem(chave),
    setItem: (chave, valor) => {
      pendente = { chave, valor };
      if (timer) clearTimeout(timer);
      timer = setTimeout(gravarAgora, ATRASO_STORAGE_MS);
    },
  };
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...criarEstadoInicial(),
      ultimoBurstRuidoEm: null,
      escolhasSurtoPendentes: {},

      adicionarFicha: () => {
        const ficha = criarFichaVazia(get().fichas.length);
        set((s) => ({ fichas: [...s.fichas, ficha], fichaAtivaId: s.fichaAtivaId ?? ficha.id }));
        return ficha.id;
      },
      atualizarFicha: (id, patch) =>
        set((s) => ({
          fichas: s.fichas.map((f) => {
            if (f.id !== id) return f;
            const atualizada = { ...f, ...patch };
            if (patch.atributos?.vontade !== undefined) {
              const novaMax = calcularSanidadeMaxima(atualizada.atributos.vontade);
              atualizada.sanidadeAtual =
                atualizada.atributos.vontade > f.atributos.vontade
                  ? novaMax
                  : Math.min(atualizada.sanidadeAtual, novaMax);
            }
            if (patch.atributos?.vigor !== undefined) {
              const novoPvMax = calcularPvMaximo(s.config.basePV, atualizada.atributos.vigor);
              atualizada.pvAtual =
                atualizada.atributos.vigor > f.atributos.vigor
                  ? novoPvMax
                  : Math.min(atualizada.pvAtual, novoPvMax);
            }
            return atualizada;
          }),
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

        let logSurtoImediato: string | null = null;
        if (alerta.surtoDisparado) {
          const d20A = Math.floor(Math.random() * 20) + 1;
          const d20B = Math.floor(Math.random() * 20) + 1;
          const resultado = resolverSurto(d20A, d20B);
          if (resultado.mesmoNumero) {
            logSurtoImediato = `${ficha.nome || 'Personagem'} · Surto · d20=${d20A}/${d20B} · o destino insiste: ${resultado.entradaA.nome} — ${resultado.entradaA.descricao}`;
            set((s) => ({
              fichas: s.fichas.map((f) =>
                f.id === id
                  ? {
                      ...f,
                      sanidadeAtual: valor,
                      surtosAtivos: [
                        ...(f.surtosAtivos ?? []),
                        { id: crypto.randomUUID(), expiraEm: s.sessaoPublica.contadorCena + 1, escolha: resultado.entradaA.nome },
                      ],
                    }
                  : f,
              ),
            }));
          } else {
            set((s) => ({
              fichas: s.fichas.map((f) =>
                f.id === id
                  ? {
                      ...f,
                      sanidadeAtual: valor,
                      surtosAtivos: [
                        ...(f.surtosAtivos ?? []),
                        { id: crypto.randomUUID(), expiraEm: s.sessaoPublica.contadorCena + 1, escolha: null },
                      ],
                    }
                  : f,
              ),
              escolhasSurtoPendentes: {
                ...s.escolhasSurtoPendentes,
                [id]: { nomeFicha: ficha.nome || 'Personagem', entradaA: resultado.entradaA, entradaB: resultado.entradaB },
              },
            }));
          }
        } else {
          set((s) => ({
            fichas: s.fichas.map((f) => (f.id === id ? { ...f, sanidadeAtual: valor } : f)),
          }));
        }
        get().registrarLog(
          'sanidade',
          `${ficha.nome || 'Personagem'}: Sanidade ${delta > 0 ? '+' : ''}${delta} (${anterior} → ${valor})`,
          id,
        );
        if (logSurtoImediato) get().registrarLog('surto', logSurtoImediato, id);
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

      resolverEscolhaSurtoPendente: (fichaId, lado) => {
        const pendente = get().escolhasSurtoPendentes[fichaId];
        if (!pendente) return;
        const entrada = lado === 'A' ? pendente.entradaA : pendente.entradaB;
        set((s) => {
          const { [fichaId]: _, ...resto } = s.escolhasSurtoPendentes;
          return {
            fichas: s.fichas.map((f) =>
              f.id === fichaId
                ? {
                    ...f,
                    surtosAtivos: (() => {
                      const arr = f.surtosAtivos ?? [];
                      let idx = -1;
                      for (let i = arr.length - 1; i >= 0; i--) {
                        if (arr[i].escolha === null) { idx = i; break; }
                      }
                      if (idx === -1) return arr;
                      const copia = [...arr];
                      copia[idx] = { ...copia[idx], escolha: entrada.nome };
                      return copia;
                    })(),
                  }
                : f,
            ),
            escolhasSurtoPendentes: resto,
          };
        });
        get().registrarLog(
          'surto',
          `${pendente.nomeFicha} · Surto · escolhido: ${entrada.nome} — ${entrada.descricao}`,
          fichaId,
        );
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

      converterDinheiro: (id, direcao, valorBruto) => {
        const ficha = get().fichas.find((f) => f.id === id);
        if (!ficha) return;
        const nome = ficha.nome || 'Personagem';

        if (direcao === 'pontoParaReal') {
          const debitado = Math.min(Math.max(0, Math.floor(valorBruto)), ficha.dinheiroPonto);
          if (debitado === 0) return;
          const creditado = Math.max(1, Math.round(debitado * 0.7));
          const novoPonto = ficha.dinheiroPonto - debitado;
          const novoReal = ficha.dinheiroReal + creditado;
          set((s) => ({
            fichas: s.fichas.map((f) => (f.id === id ? { ...f, dinheiroPonto: novoPonto, dinheiroReal: novoReal } : f)),
          }));
          get().registrarLog(
            'dinheiro',
            `${nome}: câmbio P$→R$ ${debitado} (P$ ${ficha.dinheiroPonto} → ${novoPonto}, R$ ${ficha.dinheiroReal} → ${novoReal}) — taxa do sigilo, 30%`,
            id,
          );
        } else {
          const debitado = Math.min(Math.max(0, Math.floor(valorBruto)), ficha.dinheiroReal);
          if (debitado === 0) return;
          const novoReal = ficha.dinheiroReal - debitado;
          const novoPonto = ficha.dinheiroPonto + debitado;
          set((s) => ({
            fichas: s.fichas.map((f) => (f.id === id ? { ...f, dinheiroReal: novoReal, dinheiroPonto: novoPonto } : f)),
          }));
          get().registrarLog(
            'dinheiro',
            `${nome}: câmbio R$→P$ ${debitado} (R$ ${ficha.dinheiroReal} → ${novoReal}, P$ ${ficha.dinheiroPonto} → ${novoPonto}) — origem a justificar`,
            id,
          );
        }
      },

      adicionarNpc: () => {
        const npc = criarNpcVazio();
        set((s) => ({ npcs: [...s.npcs, npc] }));
        return npc.id;
      },
      atualizarNpc: (id, patch) =>
        set((s) => ({ npcs: s.npcs.map((n) => (n.id === id ? { ...n, ...patch } : n)) })),
      removerNpc: (id) => set((s) => ({ npcs: s.npcs.filter((n) => n.id !== id) })),
      duplicarNpc: (id) =>
        set((s) => {
          const original = s.npcs.find((n) => n.id === id);
          if (!original) return s;
          const copia = { ...criarNpcVazio(), ...original, id: crypto.randomUUID(), acoes: (original.acoes ?? []).map((a) => ({ ...a, id: crypto.randomUUID() })) };
          const match = copia.nome.match(/^(.+?)(\s+(\d+))?$/);
          if (match) {
            const base = match[1];
            const num = match[3] ? parseInt(match[3], 10) + 1 : 2;
            copia.nome = `${base} ${num}`;
          }
          return { npcs: [...s.npcs, copia] };
        }),

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
      rolarIniciativa: (participanteIds) => {
        const { fichas, npcs } = get();
        const d20 = () => Math.floor(Math.random() * 20) + 1;
        const todos = [
          ...fichas.map((f) => ({ id: f.id, tipo: 'pc' as const, nome: f.nome || 'sem nome', d20: d20(), agilidade: f.atributos.agilidade })),
          ...npcs.map((n) => ({ id: n.id, tipo: 'npc' as const, nome: n.nome || 'sem nome', d20: d20(), agilidade: n.agilidade })),
        ];
        const filtrados = todos.filter((p) => participanteIds.includes(p.id));
        if (filtrados.length === 0) return;
        const ordenados = ordenarIniciativa(filtrados);
        const entradas: EntradaIniciativa[] = ordenados.map((p) => ({
          id: crypto.randomUUID(),
          participanteId: p.id,
          tipo: p.tipo,
          nome: p.nome,
          valor: p.d20 + p.agilidade,
        }));
        set((s) => ({ iniciativa: [...s.iniciativa, ...entradas] }));
        get().registrarLog('iniciativa', `iniciativa rolada — ${entradas.map((e) => `${e.nome} ${e.valor}`).join(', ')}`);
      },
      removerDaIniciativa: (id) => set((s) => ({ iniciativa: s.iniciativa.filter((e) => e.id !== id) })),
      limparIniciativa: () => set({ iniciativa: [] }),
      reordenarIniciativa: (de, para) =>
        set((s) => {
          if (de === para) return s;
          const ordem = [...s.iniciativa];
          const [movido] = ordem.splice(de, 1);
          ordem.splice(para, 0, movido);
          let indiceAtualTurno = s.sessaoPublica.indiceAtualTurno;
          if (de === indiceAtualTurno) {
            indiceAtualTurno = para;
          } else if (de < indiceAtualTurno && para >= indiceAtualTurno) {
            indiceAtualTurno--;
          } else if (de > indiceAtualTurno && para <= indiceAtualTurno) {
            indiceAtualTurno++;
          }
          return { iniciativa: ordem, sessaoPublica: { ...s.sessaoPublica, indiceAtualTurno } };
        }),

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
      encerrarModoCombate: () =>
        set((s) => ({ sessaoPublica: { ...s.sessaoPublica, modoCombate: false, condicoesCombate: {} } })),
      alternarCondicaoCombate: (participanteId, condicaoId) =>
        set((s) => {
          const condicoesMap = { ...(s.sessaoPublica.condicoesCombate ?? {}) };
          const atuais = condicoesMap[participanteId] ?? [];
          const proximas = atuais.includes(condicaoId)
            ? atuais.filter((c) => c !== condicaoId)
            : [...atuais, condicaoId];
          if (proximas.length === 0) delete condicoesMap[participanteId];
          else condicoesMap[participanteId] = proximas;
          return { sessaoPublica: { ...s.sessaoPublica, condicoesCombate: condicoesMap } };
        }),

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

      adicionarFaixaMidia: (nome, path, url) => {
        const id = crypto.randomUUID();
        set((s) => {
          const maxOrdem = s.midia.faixas.reduce((m, f) => Math.max(m, f.ordem), -1);
          const faixa: FaixaMidia = { id, nome, path, url, ordem: maxOrdem + 1, criadoEm: new Date().toISOString() };
          return { midia: { ...s.midia, faixas: [...s.midia.faixas, faixa] } };
        });
        return id;
      },
      removerFaixaMidia: (id) =>
        set((s) => ({
          midia: {
            ...s.midia,
            faixas: s.midia.faixas.filter((f) => f.id !== id),
            faixaAtualId: s.midia.faixaAtualId === id ? null : s.midia.faixaAtualId,
            tocando: s.midia.faixaAtualId === id ? false : s.midia.tocando,
          },
        })),
      moverFaixaMidia: (id, direcao) =>
        set((s) => {
          const ordenadas = [...s.midia.faixas].sort((a, b) => a.ordem - b.ordem);
          const idx = ordenadas.findIndex((f) => f.id === id);
          const alvo = direcao === 'cima' ? idx - 1 : idx + 1;
          if (idx === -1 || alvo < 0 || alvo >= ordenadas.length) return s;
          const [a, b] = [ordenadas[idx], ordenadas[alvo]];
          const faixas = s.midia.faixas.map((f) =>
            f.id === a.id ? { ...f, ordem: b.ordem } : f.id === b.id ? { ...f, ordem: a.ordem } : f,
          );
          return { midia: { ...s.midia, faixas } };
        }),
      atualizarEstadoMidia: (patch) =>
        set((s) => ({ midia: { ...s.midia, ...patch, atualizadoEm: new Date().toISOString() } })),

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

      registrarRoll: (entrada) => {
        const roll: EntradaRoll = {
          ...entrada,
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        };
        set((s) => ({ rollsLog: [roll, ...(s.rollsLog ?? [])] }));
      },
      revelarRoll: (id) =>
        set((s) => ({
          rollsLog: (s.rollsLog ?? []).map((r) => (r.id === id ? { ...r, visibilidade: 'publica' } : r)),
        })),

      atualizarSessaoPublica: (patch) => set((s) => ({ sessaoPublica: { ...s.sessaoPublica, ...patch } })),
      atualizarSessaoPrivada: (patch) => set((s) => ({ sessaoPrivada: { ...s.sessaoPrivada, ...patch } })),
      avancarCena: () =>
        set((s) => {
          const novaCena = s.sessaoPublica.contadorCena + 1;
          return {
            sessaoPublica: { ...s.sessaoPublica, contadorCena: novaCena },
            fichas: s.fichas.map((f) => ({
              ...f,
              surtosAtivos: (f.surtosAtivos ?? []).filter((surto) => surto.expiraEm !== novaCena),
            })),
          };
        }),

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
        const { fichas, fichaAtivaId, npcs, iniciativa, mapa, midia, log, rollsLog, config, sessaoPublica, sessaoPrivada, schemaVersion } =
          get();
        return JSON.stringify(
          { schemaVersion, sessaoPublica, sessaoPrivada, fichas, fichaAtivaId, npcs, iniciativa, mapa, midia, log, rollsLog, config },
          null,
          2,
        );
      },
      importarJSON: (json) => {
        let dados: EstadoGlobal;
        try {
          dados = JSON.parse(json) as EstadoGlobal;
        } catch {
          throw new Error('JSON inválido');
        }
        if (!dados || typeof dados !== 'object') throw new Error('JSON não é um objeto');
        // validação estrutural mínima
        const chavesObrigatorias = ['fichas', 'npcs', 'mapa', 'iniciativa', 'log', 'config'] as const;
        for (const k of chavesObrigatorias) if (!(k in dados)) throw new Error(`Campo obrigatório ausente: ${k}`);
        const base = criarEstadoInicial();
        const normalizar = (d: Partial<EstadoGlobal>): EstadoGlobal => ({
          schemaVersion: d.schemaVersion ?? 0,
          sessaoPublica: { ...base.sessaoPublica, ...d.sessaoPublica, condicoesCombate: d.sessaoPublica?.condicoesCombate ?? {} },
          sessaoPrivada: { ...base.sessaoPrivada, ...d.sessaoPrivada, estatisticas: { ...base.sessaoPrivada.estatisticas, ...d.sessaoPrivada?.estatisticas }, eventos: d.sessaoPrivada?.eventos ?? [], lembretes: d.sessaoPrivada?.lembretes ?? [], selecionadosIniciativa: d.sessaoPrivada?.selecionadosIniciativa ?? [] },
          fichas: (d.fichas ?? []).map((f) => ({
            ...base.fichas[0] ?? criarFichaVazia(),
            ...f,
            surtosAtivos: f.surtosAtivos ?? [],
            atributos: { ...ATRIBUTOS_ZERO, ...f.atributos },
            pericias: f.pericias ?? {},
            traumas: f.traumas ?? [],
            armas: f.armas ?? [],
            reguladores: f.reguladores ?? [],
            vinculos: f.vinculos ?? [],
            anotacoes: f.anotacoes ?? '',
            kitAntecedente: f.kitAntecedente ?? '',
            contatoOuRecurso: f.contatoOuRecurso ?? '',
            contatoUsadoNesteCaso: f.contatoUsadoNesteCaso ?? false,
            outrosItens: f.outrosItens ?? '',
            acessos: f.acessos ?? 0,
            anestesiaAte: f.anestesiaAte ?? null,
            dinheiroReal: f.dinheiroReal ?? 0,
            dinheiroPonto: f.dinheiroPonto ?? 0,
            equipamentoModificadorDefesa: f.equipamentoModificadorDefesa ?? 0,
            determinacao: f.determinacao ?? 1,
            pvAtual: f.pvAtual ?? 20,
            sanidadeAtual: f.sanidadeAtual ?? 10,
          })),
          fichaAtivaId: d.fichaAtivaId ?? null,
          npcs: (d.npcs ?? []).map((n) => ({
            ...base.npcs[0] ?? criarNpcVazio(),
            ...n,
            acoes: n.acoes ?? [],
            visivel: n.visivel ?? false,
            notasMestre: n.notasMestre ?? '',
            categoria: n.categoria ?? '',
          })),
          iniciativa: d.iniciativa ?? [],
          mapa: {
            imagemDataUrl: d.mapa?.imagemDataUrl ?? null,
            tokens: (d.mapa?.tokens ?? []).map((t) => ({
              id: t.id ?? crypto.randomUUID(),
              participanteId: t.participanteId ?? '',
              tipo: t.tipo ?? 'pc',
              x: typeof t.x === 'number' ? t.x : 0.5,
              y: typeof t.y === 'number' ? t.y : 0.5,
            })),
            grade: { ...base.mapa.grade, ...d.mapa?.grade },
          },
          midia: {
            faixas: (d.midia?.faixas ?? []).map((f) => ({
              id: f.id ?? crypto.randomUUID(),
              nome: f.nome ?? '',
              path: f.path ?? '',
              url: f.url ?? '',
              ordem: typeof f.ordem === 'number' ? f.ordem : 0,
              criadoEm: f.criadoEm ?? new Date().toISOString(),
            })),
            faixaAtualId: d.midia?.faixaAtualId ?? null,
            // nunca importa playback em curso — evita reviver "tocando: true" pra todo
            // mundo se o GM importar um JSON antigo em cima de uma sessão ao vivo.
            tocando: false,
            posicaoSegundos: 0,
            atualizadoEm: new Date(0).toISOString(),
            modoLoop: d.midia?.modoLoop ?? 'nenhum',
          },
          log: d.log ?? [],
          rollsLog: d.rollsLog ?? [],
          config: { ...base.config, ...d.config },
        });
        const estadoNormalizado = normalizar(dados);
        set({
          ...base,
          ...estadoNormalizado,
          schemaVersion: SCHEMA_VERSION,
        });
      },
      resetarEstado: () => set(criarEstadoInicial()),
    }),
    {
      name: 'estatica-mesa',
      storage: createJSONStorage(() => (ehBundleJogador ? semPersistencia : criarStorageComDebounce(localStorage))),
      version: SCHEMA_VERSION,
      partialize: (state) => state,
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
        // v4 → v5: qual entrada da Tabela de Surto está em vigor (correcoes-parte2.md item 11).
        if (versaoAnterior < 5 && estado.fichas) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          estado.fichas = estado.fichas.map((f: any) => ({ surtoEscolha: null, ...f }));
        }
        // v5 → v6: DT da cena sai dos roladores (visíveis na tela compartilhada) e vira campo
        // privado em "cena atual" — só o mestre define/vê.
        if (versaoAnterior < 6) {
          estado.sessaoPrivada = { dificuldadeCena: 'media', dificuldadeCenaCustom: 15, ...(estado.sessaoPrivada ?? {}) };
        }
        // v6 → v7: condições de combate por combatente (Parte II §4).
        if (versaoAnterior < 7) {
          estado.sessaoPublica = { condicoesCombate: {}, ...(estado.sessaoPublica ?? {}) };
        }
        // v7 → v8: selecionadosIniciativa na sessaoPrivada; reforça condicoesCombate.
        if (versaoAnterior < 8) {
          estado.sessaoPrivada = { selecionadosIniciativa: [], ...(estado.sessaoPrivada ?? {}) };
          estado.sessaoPublica = { condicoesCombate: {}, ...(estado.sessaoPublica ?? {}) };
        }
        // v8 → v9: visivel, notasMestre, categoria, acoes em Npc
        if (versaoAnterior < 9 && estado.npcs) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          estado.npcs = estado.npcs.map((n: any) => ({
            ...n,
            visivel: false,
            notasMestre: '',
            categoria: '',
            acoes: [],
          }));
        }
        // v9 → v10: rolls_log
        if (versaoAnterior < 10) {
          estado.rollsLog = [];
        }
        // v10 → v11: surto vira array surtosAtivos em cada ficha
        if (versaoAnterior < 11 && estado.fichas) {
          estado.fichas = estado.fichas.map((f: any) => {
            const { surtoAtivo, surtoEscolha, ...resto } = f;
            const surtosAtivos: SurtoAtivo[] = [];
            if (surtoAtivo != null) {
              surtosAtivos.push({
                id: crypto.randomUUID(),
                expiraEm: surtoAtivo,
                escolha: surtoEscolha ?? null,
              });
            }
            return { ...resto, surtosAtivos };
          });
        }
        // v11 → v12: garante surtosAtivos em toda ficha
        if (versaoAnterior < 12 && estado.fichas) {
          estado.fichas = estado.fichas.map((f: any) => ({ surtosAtivos: [], ...f }));
        }
        // v13 → v14: aba Mídia — jukebox sincronizado (faixas + estado de playback).
        if (versaoAnterior < 14) {
          estado.midia = criarEstadoMidia();
        }
        return estado as Store;
      },
    },
  ),
);
