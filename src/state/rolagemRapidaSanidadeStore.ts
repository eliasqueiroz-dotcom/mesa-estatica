import { create } from 'zustand';

interface RolagemRapidaSanidadeState {
  /** Contador, não boolean — mesmo motivo de outros "pedido de ação" no app (ex.
   *  `pedidoRolagem` de `QuickRollOverlayJogador`): incrementar sempre dispara o efeito, mesmo
   *  se o valor "de antes" já fosse o mesmo por acaso. */
  pedido: number;
  solicitar: () => void;
}

/**
 * Store separado do `useStore` principal, sem `persist` — mesmo padrão de `combateUiStore.ts`.
 * Existe só pra um botão no log do jogador (`LogTabJogador.tsx`, ligado ao lembrete "aliado
 * caiu a 0 PV — teste de Sanidade") conseguir "acordar" `PlayerApp.tsx` e pedir pra trocar de
 * aba + disparar a rolagem em `RoladorSanidadeJogador.tsx`, sem os dois terem acesso direto ao
 * estado um do outro.
 */
export const useRolagemRapidaSanidadeStore = create<RolagemRapidaSanidadeState>((set) => ({
  pedido: 0,
  solicitar: () => set((s) => ({ pedido: s.pedido + 1 })),
}));
