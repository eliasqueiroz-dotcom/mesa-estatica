import { create } from 'zustand';

interface MidiaUiState {
  /** Duração da faixa carregada NESTE cliente, lida do `<audio>` real ao vivo. Fato local
   *  (mesmo padrão de `soundpadUiStore.ts`) — cada cliente descobre a duração pelo próprio
   *  elemento, não dá pra sincronizar via Realtime junto do resto de `midia`. */
  duracaoSegundos: number;
  definirDuracao: (segundos: number) => void;
}

/**
 * Store separado do `useStore` principal, sem `persist`. `MidiaPlayerGM.tsx` é quem escreve
 * (dono do `<audio>`); `MidiaTab.tsx` lê pra desenhar a barra de progresso arrastável.
 */
export const useMidiaUiStore = create<MidiaUiState>((set) => ({
  duracaoSegundos: 0,
  definirDuracao: (segundos) => set({ duracaoSegundos: Number.isFinite(segundos) ? segundos : 0 }),
}));
