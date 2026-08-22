import { create } from 'zustand';
import type { Ponto } from '../features/mapa/mapaUtils';

/** Uma medição da régua de medição do mapa. Efêmera de propósito — some sozinha alguns
 *  segundos depois de terminar. */
export interface ReguaViva {
  /** = `autorId` — uma régua viva por autor, nunca acumula rastro de medições antigas. */
  id: string;
  autorId: string;
  /** corVisual da ficha, ou a cor fixa de mestre pra quem mede sem ficha própria. */
  cor: string;
  /** 0-1 normalizado à IMAGEM — mesma base de `TokenMapa`/`GradeMapa`. */
  pontos: Ponto[];
  /** `Date.now()` do relógio LOCAL de quem está exibindo — nunca o timestamp de quem mediu
   *  (relógios de máquinas diferentes não batem; ver `ReguaOverlay.tsx`). Base do fade. */
  atualizadaEm: number;
  /** true enquanto o autor ainda está arrastando — réguas ativas não expiram pelo limiar normal
   *  (não pode sumir no meio de uma medição real), só pela rede de segurança de
   *  `limiarAtivaSemAtualizarMs` em `expirarAntigas` (autor sumiu sem avisar: minimizou,
   *  caiu a rede, fechou o notebook — ver `useRegua.ts` pro caminho feliz, que evita isso). */
  ativa: boolean;
}

interface ReguasState {
  reguas: Record<string, ReguaViva>;
  upsertRegua: (regua: ReguaViva) => void;
  removerRegua: (id: string) => void;
  /** Remove réguas inativas cuja `atualizadaEm` já passou do limiar de fade — chamado por um
   *  timer no `ReguaOverlay`, nunca direto por interação do usuário. `limiarAtivaSemAtualizarMs`
   *  (default `Infinity` = desligado) é a rede de segurança: uma régua `ativa` que nunca mais
   *  se renovou (autor sumiu sem mandar o fim) expira mesmo assim, depois de um prazo bem mais
   *  generoso que o de fade normal. */
  expirarAntigas: (agora: number, limiarInativaMs: number, limiarAtivaSemAtualizarMs?: number) => void;
}

/**
 * Store separado do `useStore` principal — de propósito SEM `persist`. O store principal
 * salva tudo (`partialize: (state) => state`, `state/store.ts`) no localStorage e no export
 * JSON; uma régua que vive alguns segundos não pode vazar pra nenhum dos dois.
 */
export const useReguasStore = create<ReguasState>((set) => ({
  reguas: {},
  upsertRegua: (regua) => set((s) => ({ reguas: { ...s.reguas, [regua.id]: regua } })),
  removerRegua: (id) =>
    set((s) => {
      if (!(id in s.reguas)) return s;
      const { [id]: _removida, ...resto } = s.reguas;
      return { reguas: resto };
    }),
  expirarAntigas: (agora, limiarInativaMs, limiarAtivaSemAtualizarMs = Infinity) =>
    set((s) => {
      const restantes: Record<string, ReguaViva> = {};
      let mudou = false;
      for (const [id, regua] of Object.entries(s.reguas)) {
        const expirouInativa = !regua.ativa && agora - regua.atualizadaEm > limiarInativaMs;
        const expirouAtivaAbandonada = regua.ativa && agora - regua.atualizadaEm > limiarAtivaSemAtualizarMs;
        if (expirouInativa || expirouAtivaAbandonada) {
          mudou = true;
          continue;
        }
        restantes[id] = regua;
      }
      return mudou ? { reguas: restantes } : s;
    }),
}));
