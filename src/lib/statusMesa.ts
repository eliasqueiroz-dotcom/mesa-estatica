import { create } from 'zustand';

export type StatusLocal = 'ok' | 'erro';
export type StatusSync = 'sem-config' | 'conectado' | 'erro';

interface StatusMesaState {
  local: StatusLocal;
  /** Nomes dos canais Realtime atualmente `SUBSCRIBED`. O texto do indicador continua agregado
   *  (um aviso só), mas o tooltip nomeia os canais com erro — sem isso, "sync com erro" é
   *  indistinguível de ruído de rede. Foi o que escondeu por dias a régua/AoE caídos quando os
   *  canais viraram `private: true` sem a policy correspondente no banco (migração 0025). */
  canaisConectados: Set<string>;
  canaisComErro: Set<string>;
  /** Erro fora do ciclo de render (Promise rejeitada sem `.catch`, exceção síncrona num
   *  callback/timer) — não passa pelo Error Boundary, que só pega erro de render. Mensagem
   *  crua, só pra dar contexto no tooltip; `null` = nada pendente. */
  erroRuntime: string | null;
  /** `navigator.onLine` — sinal independente dos canais Realtime: um canal pode estar com
   *  erro por motivo alheio (policy faltando, RLS) mesmo com internet normal, e o browser
   *  pode saber que caiu a rede antes de qualquer canal reportar erro. `instalarDetectorConectividade`
   *  mantém isso em dia; sem chamar, fica sempre `true` (assume online). */
  online: boolean;
}

/** Store efêmero, fora do `persist` de propósito — é sinal de runtime (gravou agora? o
 *  Realtime está de pé agora?), não estado da mesa; não deve ir pro localStorage nem pro
 *  export/import JSON. */
export const useStatusMesa = create<StatusMesaState>(() => ({
  local: 'ok',
  canaisConectados: new Set(),
  canaisComErro: new Set(),
  erroRuntime: null,
  online: typeof navigator === 'undefined' || navigator.onLine,
}));

/** Chamar uma vez no boot de cada bundle, ao lado de `instalarHandlerGlobalDeErro()` — mesmo
 *  padrão (`typeof window === 'undefined'` é a saída deliberada em ambiente de teste Node
 *  puro, sem jsdom, mesmo raciocínio de `criarStorageComDebounce`/`globalErrorHandler.ts`). */
export function instalarDetectorConectividade(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => useStatusMesa.setState({ online: true }));
  window.addEventListener('offline', () => useStatusMesa.setState({ online: false }));
}

export function marcarLocalOk(): void {
  if (useStatusMesa.getState().local !== 'ok') useStatusMesa.setState({ local: 'ok' });
}

export function marcarLocalErro(): void {
  useStatusMesa.setState({ local: 'erro' });
}

/**
 * Callback pronto pra passar direto pro `.subscribe(status => ...)` de um canal Realtime —
 * cada módulo de sync (`fichasSync.ts`, `tokensSync.ts`, etc.) chama isso com o próprio nome
 * de canal. O indicador consolida todos: mostra "erro" se QUALQUER canal estiver com
 * problema, "conectado" se pelo menos um estiver de pé, "sem-config" se nenhum nunca chegou
 * a existir (sem env vars do Supabase, ou ainda conectando).
 */
export function assinarStatusCanal(nomeCanal: string) {
  return (status: string) => {
    useStatusMesa.setState((s) => {
      const conectados = new Set(s.canaisConectados);
      const comErro = new Set(s.canaisComErro);
      if (status === 'SUBSCRIBED') {
        conectados.add(nomeCanal);
        comErro.delete(nomeCanal);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        comErro.add(nomeCanal);
        conectados.delete(nomeCanal);
      }
      return { canaisConectados: conectados, canaisComErro: comErro };
    });
  };
}

/**
 * Como `assinarStatusCanal`, mas também dispara `refetch` quando o canal SAI de erro
 * (`CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED`) e VOLTA a `SUBSCRIBED` — nunca no primeiro
 * `SUBSCRIBED` (isso já é coberto pela busca inicial de cada módulo). O Realtime não reenvia
 * eventos perdidos durante a queda de um canal — sem isso, ficha/iniciativa/mapa de quem caiu
 * fica desatualizado até um reload manual (achado em 24/08, auditoria pré-sessão).
 */
export function assinarStatusCanalComRefetch(nomeCanal: string, refetch: () => void | PromiseLike<void>) {
  const base = assinarStatusCanal(nomeCanal);
  let viuErro = false;
  return (status: string) => {
    base(status);
    if (status === 'SUBSCRIBED') {
      if (viuErro) void refetch();
      viuErro = false;
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      viuErro = true;
    }
  };
}

/** Chamar no cleanup do módulo de sync, antes de `removeChannel` — desmontagem intencional
 *  (troca de aba, fim de sessão) não deve acender o aviso de erro pro resto da mesa. */
export function desconectarCanal(nomeCanal: string): void {
  useStatusMesa.setState((s) => {
    if (!s.canaisConectados.has(nomeCanal) && !s.canaisComErro.has(nomeCanal)) return s;
    const conectados = new Set(s.canaisConectados);
    const comErro = new Set(s.canaisComErro);
    conectados.delete(nomeCanal);
    comErro.delete(nomeCanal);
    return { canaisConectados: conectados, canaisComErro: comErro };
  });
}

export function statusSincronizacao(s: Pick<StatusMesaState, 'canaisConectados' | 'canaisComErro'>): StatusSync {
  if (s.canaisComErro.size > 0) return 'erro';
  if (s.canaisConectados.size > 0) return 'conectado';
  return 'sem-config';
}

export function marcarErroRuntime(mensagem: string): void {
  useStatusMesa.setState({ erroRuntime: mensagem });
}

export function limparErroRuntime(): void {
  useStatusMesa.setState({ erroRuntime: null });
}
