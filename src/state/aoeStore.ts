import { create } from 'zustand';
import type { TemplateAoE } from '../features/mapa/aoeGeometria';

/** Template de área de efeito ao vivo — igual `TemplateAoE`, mais `ativa` só pra sincronização
 *  saber quando debounçar (ainda arrastando) vs. mandar na hora (soltou o ponteiro), mesmo
 *  papel de `ReguaViva.ativa` (`reguasStore.ts`). Ao contrário da régua, não precisa expirar
 *  sozinha — a AoE fica visível até o mestre limpar, não some depois de alguns segundos. */
export interface AoeVivo extends TemplateAoE {
  ativa: boolean;
}

interface AoeState {
  template: AoeVivo | null;
  definirTemplate: (t: AoeVivo | null) => void;
}

/**
 * Store separado do `useStore` principal — de propósito SEM `persist`, mesmo motivo de
 * `reguasStore.ts`: é estado de interação ao vivo (um mestre desenhando uma área), não estado
 * da mesa; não pode vazar pro localStorage nem pro export/import JSON.
 *
 * Só `AoEOverlay.tsx` (arquivo GM-only, nunca entra no bundle do jogador) chama
 * `definirTemplate` — o lado do jogador só LÊ este store pra desenhar (`AoEViewOverlay.tsx`),
 * nunca escreve. Não é uma trava de código, é o mesmo sigilo por bundle já usado no projeto
 * pro resto das ferramentas exclusivas de mestre.
 */
export const useAoeStore = create<AoeState>((set) => ({
  template: null,
  definirTemplate: (t) => set({ template: t }),
}));
