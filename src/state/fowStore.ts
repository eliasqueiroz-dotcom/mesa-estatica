import { create } from 'zustand';
import type { RegiaoFoW } from './types';

/** Rascunho de uma região de FoW enquanto o GM arrasta o próximo retângulo (efêmero de propósito
 *  — igual `aoeStore.ts`/`reguasStore.ts`: estado de interação ao vivo, NÃO persiste em
 *  localStorage nem vaza pro export/import JSON). Quando o GM solta o ponteiro, o rascunho vira
 *  entrada persistente em `mapa.fow` (`useStore.adicionarRegiaoFoW`) e some daqui. */
export interface RascunhoRegiao extends Pick<RegiaoFoW, 'x' | 'y' | 'w' | 'h' | 'forma'> {
  /** `ativa: true` = arrastando (debounça o push no `fowSync.ts`); `false` = soltou o ponteiro,
   *  envio final imediato — mesmo padrão de `AoeVivo.ativa`. */
  ativa: boolean;
  /** `"revelar"` (entra em `vistas` ∪ `visiveisAgora`) vs `"cobrirLuz"` (mantém `vistas`, remove
   *  de `visiveisAgora`) vs `"esquecer"` (some de ambas) — só pra o GM-only `FoWOverlay.tsx`
   *  saber qual setter chamar no `up`. */
  modo: 'revelar' | 'cobrirLuz' | 'esquecer';
}

interface FowState {
  rascunho: RascunhoRegiao | null;
  definirRascunho: (r: RascunhoRegiao | null) => void;
}

export const useFowStore = create<FowState>((set) => ({
  rascunho: null,
  definirRascunho: (r) => set({ rascunho: r }),
}));