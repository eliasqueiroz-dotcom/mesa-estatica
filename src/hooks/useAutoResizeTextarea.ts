import { useLayoutEffect, useRef } from 'react';

/** Cresce o textarea junto com o conteúdo, sem nunca ficar menor que a altura definida por
 *  `rows`/CSS. `maxHeight` (px) é opcional — sem ele a caixa cresce livremente. */
export function useAutoResizeTextarea(value: string, maxHeight?: number) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '';
    const minimo = el.clientHeight;
    const necessario = el.scrollHeight;
    const alvo = maxHeight ? Math.min(Math.max(necessario, minimo), maxHeight) : Math.max(necessario, minimo);
    el.style.height = `${alvo}px`;
  }, [value, maxHeight]);

  return ref;
}
