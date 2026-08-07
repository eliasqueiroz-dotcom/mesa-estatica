import { create } from 'zustand';
import type { Ponto } from '../features/mapa/mapaUtils';

/** Um ping — clique único no mapa, vira um pulso visível pra todo mundo conectado e some
 *  sozinho. Efêmero de propósito, mesmo princípio de `ReguaViva` (reguasStore.ts). */
export interface PingVivo {
  /** `crypto.randomUUID()` — ao contrário da régua (1 por autor), dois pings seguidos da MESMA
   *  pessoa devem coexistir na tela, não se substituir. */
  id: string;
  autorId: string;
  /** corVisual da ficha, ou a cor fixa de mestre pra quem pinga sem ficha própria. */
  cor: string;
  /** 0-1 normalizado à IMAGEM — mesma base de TokenMapa/GradeMapa/ReguaViva. */
  ponto: Ponto;
  /** `Date.now()` do relógio LOCAL de quem está exibindo — nunca o timestamp de quem pingou
   *  (relógios de máquinas diferentes não batem; mesmo cuidado de `ReguaViva.atualizadaEm`). */
  criadoEm: number;
}

interface PingsState {
  pings: Record<string, PingVivo>;
  adicionarPing: (ping: PingVivo) => void;
  removerPing: (id: string) => void;
  /** Remove pings cujo `criadoEm` já passou do limiar de exibição — chamado por um timer no
   *  `PingOverlay`, nunca direto por interação do usuário. */
  expirarAntigos: (agora: number, limiarMs: number) => void;
}

/**
 * Store separado do `useStore` principal — de propósito SEM `persist`, mesmo motivo de
 * `reguasStore.ts`: um ping que vive ~1 segundo não pode vazar pro localStorage nem pro
 * export/import JSON.
 */
export const usePingsStore = create<PingsState>((set) => ({
  pings: {},
  adicionarPing: (ping) => set((s) => ({ pings: { ...s.pings, [ping.id]: ping } })),
  removerPing: (id) =>
    set((s) => {
      if (!(id in s.pings)) return s;
      const { [id]: _removido, ...resto } = s.pings;
      return { pings: resto };
    }),
  expirarAntigos: (agora, limiarMs) =>
    set((s) => {
      const restantes: Record<string, PingVivo> = {};
      let mudou = false;
      for (const [id, ping] of Object.entries(s.pings)) {
        if (agora - ping.criadoEm > limiarMs) {
          mudou = true;
          continue;
        }
        restantes[id] = ping;
      }
      return mudou ? { pings: restantes } : s;
    }),
}));
