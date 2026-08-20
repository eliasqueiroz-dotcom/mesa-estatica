import { create } from 'zustand';

interface SoundpadUiState {
  /** Slots tocando agora NESTE cliente. "Tocando" é fato local — cada cliente (mestre e cada
   *  jogador) toca seu próprio `<audio>` ao receber o comando sincronizado, então não tem como
   *  isso ser estado compartilhado como `soundpad.sons`/`volume`. */
  slotsTocando: Set<number>;
  marcarTocando: (slot: number) => void;
  marcarParado: (slot: number) => void;
}

/**
 * Store separado do `useStore` principal, sem `persist` — mesmo padrão de `combateUiStore.ts`:
 * é fato de interação ao vivo (este slot está audível agora, neste navegador), não estado da
 * mesa. `SoundpadPlayer.tsx` é quem escreve (dono dos elementos `<audio>`); `SoundpadGrid.tsx`
 * lê pra decidir se clicar no botão deve tocar ou parar o efeito, e pra mostrar qual tá tocando.
 */
export const useSoundpadUiStore = create<SoundpadUiState>((set) => ({
  slotsTocando: new Set<number>(),
  marcarTocando: (slot) =>
    set((s) => {
      const novo = new Set(s.slotsTocando);
      novo.add(slot);
      return { slotsTocando: novo };
    }),
  marcarParado: (slot) =>
    set((s) => {
      if (!s.slotsTocando.has(slot)) return s;
      const novo = new Set(s.slotsTocando);
      novo.delete(slot);
      return { slotsTocando: novo };
    }),
}));
