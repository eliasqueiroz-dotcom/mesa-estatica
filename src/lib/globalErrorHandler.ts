import { marcarErroRuntime } from './statusMesa';

/** Extrai uma mensagem legível de qualquer coisa que possa aparecer em `ErrorEvent.error` ou
 *  `PromiseRejectionEvent.reason` — nem sempre é um `Error` de verdade (código de terceiro
 *  pode rejeitar com string, objeto, undefined). Função pura, testável sem precisar de um
 *  `window` de verdade. */
export function mensagemDoErro(motivo: unknown): string {
  if (motivo instanceof Error) return motivo.message;
  if (typeof motivo === 'string') return motivo;
  return String(motivo);
}

/**
 * Erros fora do ciclo de render do React — Promise rejeitada sem `.catch`, exceção síncrona
 * dentro de um `setTimeout`/callback de evento — nunca chegam no `ErrorBoundary` (que só pega
 * erro de render). Sem isso, somem só no console; o mestre não descobre que algo quebrou no
 * meio da sessão a menos que abra o DevTools. Só torna visível (acende o indicador no
 * header via `statusMesa`) — não tenta recuperar nem suprimir nada, o console continua
 * mostrando o erro normalmente.
 */
export function instalarHandlerGlobalDeErro(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (e) => {
    marcarErroRuntime(mensagemDoErro(e.error ?? e.message));
  });
  window.addEventListener('unhandledrejection', (e) => {
    marcarErroRuntime(mensagemDoErro(e.reason));
  });
}
