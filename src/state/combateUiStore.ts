import { create } from 'zustand';

interface CombateUiState {
  /** Seleção pra "aplicar a N" (dano/condição em área) — existe só depois que o combate já
   *  começou. Compartilhada entre painéis (NpcsTab, CombatOverlay) que renderizam a MESMA
   *  iniciativa: sem isso, cada `useIniciativa()` criava sua própria cópia local e escolher
   *  alvos num painel deixava o outro achando que nada estava selecionado (ou selecionado
   *  diferente) — confuso e arriscado no meio de uma ação de dano em área ao vivo. */
  selecionadosAplicar: Set<string>;
  toggleSelecionadoAplicar: (id: string) => void;
  limparSelecaoAplicar: () => void;
  /** "agrupar NPCs selecionados" ao rolar iniciativa — acompanha `selecionadosIniciativa`
   *  (esse sim já vivia no useStore principal, persistido) pelo mesmo motivo: é decisão de UMA
   *  rolagem em andamento, não de um painel específico. */
  agruparNpcs: boolean;
  setAgruparNpcs: (v: boolean) => void;
  /** Ficha.id escolhida como socorrista, por alvo (participanteId de quem está a 0 PV). */
  socorristaPorAlvo: Record<string, string>;
  definirSocorrista: (alvoId: string, fichaId: string) => void;
}

/**
 * Store separado do `useStore` principal — de propósito SEM `persist`, mesmo motivo de
 * `aoeStore.ts`/`reguasStore.ts`: é estado de interação AO VIVO de um combate em andamento
 * (quem está selecionado pra levar dano em área agora, quem foi escolhido como socorrista),
 * não estado da mesa — não faz sentido sobreviver a um reload nem entrar no export/import JSON.
 * Existir num store à parte (em vez de `useState` dentro de `useIniciativa()`) é o que permite
 * dois painéis montados ao mesmo tempo (NpcsTab, CombatOverlay) compartilharem a mesma seleção.
 */
export const useCombateUiStore = create<CombateUiState>((set) => ({
  selecionadosAplicar: new Set<string>(),
  toggleSelecionadoAplicar: (id) =>
    set((s) => {
      const novo = new Set(s.selecionadosAplicar);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return { selecionadosAplicar: novo };
    }),
  limparSelecaoAplicar: () => set({ selecionadosAplicar: new Set() }),
  agruparNpcs: false,
  setAgruparNpcs: (v) => set({ agruparNpcs: v }),
  socorristaPorAlvo: {},
  definirSocorrista: (alvoId, fichaId) =>
    set((s) => ({ socorristaPorAlvo: { ...s.socorristaPorAlvo, [alvoId]: fichaId } })),
}));
