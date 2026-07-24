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
