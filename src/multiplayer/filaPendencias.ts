import { create } from 'zustand';
import { statusSincronizacao, useStatusMesa } from '../lib/statusMesa';

/**
 * Fila genérica de "isso não confirmou push, reenviar quando a conexão voltar" — não sabe
 * nada sobre tokens/FoW/réguas, só sabe módulo+chave+callback. Cada módulo de sync troca o
 * `.then(({error}) => console.error(...))` que só loga a falha hoje por uma chamada que
 * registra a pendência aqui; o reenvio relê o estado ATUAL da store no momento em que roda
 * (nunca um payload fechado sobre uma variável antiga) — as regras de sync já são
 * last-write-wins (mesa-estatica-multiplayer-completo.md §8), então reenviar o valor mais
 * recente é sempre correto, não precisa de histórico de operações.
 *
 * Persistimos só METADADOS (`{modulo, chave}`), não o payload: o Zustand `persist` da mesa já
 * grava o estado mais recente a cada mudança local, então depois de um reload a store já tem
 * a edição que falhou em sincronizar — a fila só precisa lembrar QUAL chave ficou pendente,
 * quem decide o que reenviar é o próprio módulo (via `retomarPendenciasPersistidas`).
 */

export interface PendenciaItem {
  modulo: string;
  chave: string;
}

const CHAVE_STORAGE = 'estatica-pendencias-v1';
const ATRASO_PERSISTENCIA_MS = 200;

const idDe = (modulo: string, chave: string): string => `${modulo}:${chave}`;

/** Lê os metadados persistidos de um `Storage` — função pura, testável sem `localStorage`
 *  de verdade (mesmo padrão de `criarStorageComDebounce` em `state/store.ts`). JSON
 *  corrompido/formato inesperado vira fila vazia, nunca lança. */
export function lerPendenciasPersistidas(bruto: Pick<Storage, 'getItem'>): PendenciaItem[] {
  try {
    const cru = bruto.getItem(CHAVE_STORAGE);
    if (!cru) return [];
    const parsed: unknown = JSON.parse(cru);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is PendenciaItem =>
        typeof x === 'object' && x !== null && typeof (x as PendenciaItem).modulo === 'string' && typeof (x as PendenciaItem).chave === 'string',
    );
  } catch {
    return [];
  }
}

/** Grava os metadados num `Storage` — engole falha (quota/indisponível) porque isso é só
 *  metadado de retry: perder a fila persistida no pior caso custa uma pendência que só é
 *  redescoberta no próximo push local, não perda de dado real (a store principal com os
 *  dados tem seu próprio tratamento em `criarStorageComDebounce`). */
export function gravarPendencias(bruto: Pick<Storage, 'setItem'>, itens: PendenciaItem[]): void {
  try {
    bruto.setItem(CHAVE_STORAGE, JSON.stringify(itens));
  } catch (erro) {
    console.error('[filaPendencias] gravação de metadados falhou', erro);
  }
}

const storageDisponivel: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null;

interface FilaPendenciasState {
  itens: PendenciaItem[];
}

export const usePendenciasStore = create<FilaPendenciasState>(() => ({
  itens: storageDisponivel ? lerPendenciasPersistidas(storageDisponivel) : [],
}));

let timerPersistencia: ReturnType<typeof setTimeout> | null = null;

function persistirComAtraso(): void {
  if (!storageDisponivel) return;
  if (timerPersistencia) clearTimeout(timerPersistencia);
  timerPersistencia = setTimeout(() => {
    timerPersistencia = null;
    gravarPendencias(storageDisponivel, usePendenciasStore.getState().itens);
  }, ATRASO_PERSISTENCIA_MS);
}

if (typeof window !== 'undefined') {
  const flush = () => {
    if (timerPersistencia) clearTimeout(timerPersistencia);
    timerPersistencia = null;
    if (storageDisponivel) gravarPendencias(storageDisponivel, usePendenciasStore.getState().itens);
  };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

/** Callbacks de retry em memória — nunca persistidos (não sobrevivem a reload por natureza;
 *  quem reidrata é `retomarPendenciasPersistidas`, chamado no boot de cada módulo). */
const callbacksPendentes = new Map<string, () => void | Promise<void>>();

export function registrarPendencia(modulo: string, chave: string, tentarNovamente: () => void | Promise<void>): void {
  const id = idDe(modulo, chave);
  callbacksPendentes.set(id, tentarNovamente);
  const jaListado = usePendenciasStore.getState().itens.some((it) => idDe(it.modulo, it.chave) === id);
  if (!jaListado) {
    usePendenciasStore.setState((s) => ({ itens: [...s.itens, { modulo, chave }] }));
  }
  persistirComAtraso();
}

export function resolverPendencia(modulo: string, chave: string): void {
  const id = idDe(modulo, chave);
  callbacksPendentes.delete(id);
  const estava = usePendenciasStore.getState().itens.some((it) => idDe(it.modulo, it.chave) === id);
  if (!estava) return;
  usePendenciasStore.setState((s) => ({ itens: s.itens.filter((it) => idDe(it.modulo, it.chave) !== id) }));
  persistirComAtraso();
}

/**
 * Wrapper de conveniência pro padrão universal dos módulos de sync: `cliente.from(...).upsert
 * /delete(...).then(({error}) => ...)`. Sucesso resolve a pendência; erro (retornado como
 * `{error}` ou por rejeição da promise) registra com um callback que re-executa a mesma
 * `executar` — quem chama decide o que `executar` lê da store no momento em que roda de novo.
 */
export function executarComRetentativa(
  modulo: string,
  chave: string,
  executar: () => PromiseLike<{ error: unknown } | null | undefined>,
): void {
  const tentar = (): void => {
    Promise.resolve(executar())
      .then((resultado) => {
        if (resultado && resultado.error) {
          console.error(`[filaPendencias] ${modulo}:${chave} falhou, aguardando reconexão`, resultado.error);
          registrarPendencia(modulo, chave, tentar);
        } else {
          resolverPendencia(modulo, chave);
        }
      })
      .catch((erro: unknown) => {
        console.error(`[filaPendencias] ${modulo}:${chave} falhou, aguardando reconexão`, erro);
        registrarPendencia(modulo, chave, tentar);
      });
  };
  tentar();
}

/** Leitura pura das chaves pendentes de um módulo (não remove nada) — cada `iniciarSyncX()`
 *  chama isso no boot pra saber o que reenviar; quem decide COMO reenviar (upsert vs delete,
 *  reler a store atual) é o próprio módulo. */
export function retomarPendenciasPersistidas(modulo: string): string[] {
  return usePendenciasStore
    .getState()
    .itens.filter((it) => it.modulo === modulo)
    .map((it) => it.chave);
}

export function usePendenciasCount(): number {
  return usePendenciasStore((s) => s.itens.length);
}

export function usePendenciasDetalhe(): PendenciaItem[] {
  return usePendenciasStore((s) => s.itens);
}

/** Dispara todos os callbacks de retry registrados agora — chaves só com metadado persistido
 *  (nenhum módulo ainda relêu/registrou um callback de verdade nesta sessão) são ignoradas
 *  até o módulo correspondente montar e chamar `retomarPendenciasPersistidas`. */
export function tentarTodasPendencias(): void {
  for (const tentar of [...callbacksPendentes.values()]) void tentar();
}

/**
 * Chamar uma vez no boot de cada bundle (`entries/mestre.tsx`/`jogador.tsx`), ao lado de
 * `instalarHandlerGlobalDeErro()`. Dois gatilhos de reenvio automático: o evento `online` do
 * browser, e a transição de `statusSincronizacao` de `'erro'` pra `'conectado'` (qualquer
 * canal reconectando — aproximação aceitável, mesmo espírito agregado do `StatusIndicador`).
 */
export function instalarRetentativaAutomatica(): void {
  if (typeof window !== 'undefined') {
    window.addEventListener('online', tentarTodasPendencias);
  }

  let statusAnterior = statusSincronizacao(useStatusMesa.getState());
  useStatusMesa.subscribe((s) => {
    const atual = statusSincronizacao(s);
    if (statusAnterior === 'erro' && atual === 'conectado') tentarTodasPendencias();
    statusAnterior = atual;
  });
}
