import { DIFICULDADES } from '../../rules/data/dificuldades';
import { useStore } from '../../state/store';

/** DT da cena atual — definida pelo mestre em "Sessão → cena atual" (campo privado). Os
 *  roladores usam esse valor pra calcular sucesso/falha sem expor o número na tela
 *  compartilhada nem no log. */
export function useDtDaCena(): number {
  const dificuldadeCena = useStore((s) => s.sessaoPrivada.dificuldadeCena);
  const dificuldadeCenaCustom = useStore((s) => s.sessaoPrivada.dificuldadeCenaCustom);
  const dificuldade = DIFICULDADES.find((d) => d.id === dificuldadeCena)!;
  return dificuldade.dt ?? dificuldadeCenaCustom;
}
