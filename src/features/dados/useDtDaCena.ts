import { DIFICULDADES } from '../../rules/data/dificuldades';
import { useStore } from '../../state/store';

/** DT da cena atual — definida pelo mestre em "Sessão → cena atual" (campo privado). Os
 *  roladores usam esse valor pra calcular sucesso/falha sem expor o número na tela
 *  compartilhada nem no log. */
export function useDtDaCena(): number {
  const dificuldadeCena = useStore((s) => s.sessaoPrivada.dificuldadeCena);
  const dificuldadeCenaCustom = useStore((s) => s.sessaoPrivada.dificuldadeCenaCustom);
  // fallback pra "média" (DT15): estado persistido de uma versão anterior à migração v6 pode
  // não ter esse campo ainda — nunca deixar o app inteiro quebrar por causa da DT.
  const dificuldade = DIFICULDADES.find((d) => d.id === dificuldadeCena) ?? DIFICULDADES.find((d) => d.id === 'media')!;
  return dificuldade.dt ?? dificuldadeCenaCustom ?? 15;
}
