import { useStore } from '../../state/store';
import type { MapaBiblioteca } from '../../state/types';

/** O item da biblioteca em cena agora, ou `null` sem nenhum selecionado. `.find` devolve a
 *  MESMA referência do array quando nada mudou (sem alocar objeto novo) — selector seguro pro
 *  Zustand, mesmo padrão de outros selectors derivados do projeto. */
export function useMapaAtivo(): MapaBiblioteca | null {
  return useStore((s) => s.mapa.biblioteca.find((m) => m.id === s.mapa.mapaAtivoId) ?? null);
}
