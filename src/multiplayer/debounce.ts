/**
 * Debounce por chave — cada chave tem seu próprio timer independente (editar a ficha A não
 * atrasa o push da ficha B; arrastar o token X não atrasa o token Y). Chamadas repetidas pra
 * mesma chave descartam o valor anterior e reiniciam o atraso — só a versão mais recente
 * chega a `executar`.
 */
export function criarDebouncePorChave<T>(atrasoMs: number, executar: (chave: string, valor: T) => void) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  return (chave: string, valor: T) => {
    const timerAnterior = timers.get(chave);
    if (timerAnterior) clearTimeout(timerAnterior);
    timers.set(
      chave,
      setTimeout(() => {
        timers.delete(chave);
        executar(chave, valor);
      }, atrasoMs),
    );
  };
}

/**
 * Throttle por chave (leading + trailing) — diferente do debounce acima, que só dispara quando
 * as chamadas PARAM. Aqui a primeira chamada de uma chave "fria" executa na hora; chamadas
 * seguintes dentro do `intervaloMs` só guardam o valor mais recente, que dispara no próximo
 * "tick"; sem chamada nenhuma dentro de um tick, a chave volta a ficar fria (próxima chamada
 * executa na hora de novo). Usado onde a série de chamadas representa um movimento contínuo
 * (arrastar um token) e quem observa precisa ver passos ao longo do caminho, não só o valor
 * final — um debounce puro aqui só dispara ~intervaloMs depois que o movimento PARA, escondendo
 * o trajeto inteiro (era a causa do "só vejo o token pulando pro final" com 2+ conectados).
 */
export function criarThrottlePorChave<T>(intervaloMs: number, executar: (chave: string, valor: T) => void) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const pendentes = new Map<string, T>();

  return (chave: string, valor: T) => {
    if (timers.has(chave)) {
      pendentes.set(chave, valor);
      return;
    }

    executar(chave, valor);
    const tick = () => {
      const pendente = pendentes.get(chave);
      if (pendente === undefined) {
        timers.delete(chave);
        return;
      }
      pendentes.delete(chave);
      executar(chave, pendente);
      timers.set(chave, setTimeout(tick, intervaloMs));
    };
    timers.set(chave, setTimeout(tick, intervaloMs));
  };
}
