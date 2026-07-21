import { DIFICULDADES } from '../../rules/data/dificuldades';
import { useStore } from '../../state/store';

/** DT da cena atual — definida pelo mestre em "Sessão → cena atual" (campo privado). Os
 *  roladores usam esse valor pra calcular sucesso/falha sem expor o número na tela
 *  compartilhada nem no log. */
export function useDtDaCena(): number {
  const sessaoPrivada = useStore((s) => s.sessaoPrivada);
  // fallback pra "média" (DT15): estado persistido de uma versão anterior à migração v6 pode
  // não ter esse campo ainda — nunca deixar o app inteiro quebrar por causa da DT.
  // Blindagem extra: sessaoPrivada pode ser null/undefined se o localStorage estiver corrompido
  // (schemaVersion divergente da migração real). Se for o caso, usa os defaults.
  const dificuldadeCena = sessaoPrivada?.dificuldadeCena ?? 'media';
  const dificuldadeCenaCustom = sessaoPrivada?.dificuldadeCenaCustom ?? 15;
  const dificuldade = DIFICULDADES.find((d) => d.id === dificuldadeCena) ?? DIFICULDADES.find((d) => d.id === 'media')!;
  return Math.max(1, dificuldade.dt ?? dificuldadeCenaCustom);
}
