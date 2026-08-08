import { create } from 'zustand';
import type { RollTermo } from '../dice/useDiceBox';
import type { ColorsetId } from '../dice/colorsets';
import type { TipoRolagemForcada } from '../dice/registroForcados';

/** Uma rolagem de jogador em trânsito pra ser reproduzida na tela de todo mundo. */
export interface RolagemAoVivo {
  id: string;
  /** mesmo shape de useDiceBox — termos na ordem em que os dados foram criados. */
  termos: RollTermo[];
  /** valores já resolvidos, na mesma ordem dos termos — `reproduzir()` os força na física. */
  valores: number[];
  /** paleta de fundo/vidro pelo tipo de rolagem (rede=teste, ruido=sanidade/surto/trauma). */
  colorsetBase: ColorsetId;
  /** corVisual de quem rolou — sobrepõe os números do dado. */
  cor: string;
  /** nome de quem rolou, pro aviso "X está rolando". */
  origem: string;
  tipo: TipoRolagemForcada;
}

interface RolagemAoVivoState {
  atual: RolagemAoVivo | null;
  definirAtual: (r: RolagemAoVivo | null) => void;
}

/**
 * Store separado do `useStore` principal — de propósito SEM `persist`, mesmo motivo de
 * `aoeStore.ts`/`pingsStore.ts`: é estado de interação ao vivo (um jogador rolando agora), não
 * estado da mesa; não pode vazar pro localStorage nem pro export/import JSON.
 *
 * Só os componentes do JOGADOR (`DadosTabJogador.tsx`, `QuickRollOverlayJogador.tsx`) chamam
 * `definirAtual` — o mestre nunca publica a própria rolagem aqui, só lê via
 * `RolagemAoVivoPlayer.tsx`. Mesmo sigilo por bundle já usado no projeto, não uma trava de
 * runtime.
 */
export const useRolagemAoVivoStore = create<RolagemAoVivoState>((set) => ({
  atual: null,
  definirAtual: (r) => set({ atual: r }),
}));

/** Ids de rolagens que o PRÓPRIO cliente publicou — sem isso, o jogador que rolou reproduziria
 *  a própria rolagem de novo ao ler o store de volta (o mesmo `definirAtual` que dispara o
 *  broadcast pros outros também aciona os consumidores locais: `RolagemAoVivoPlayer.tsx` no
 *  header, e agora `DadosTab.tsx`/`DadosTabJogador.tsx` reproduzindo na própria bandeja — sem o
 *  filtro, a bandeja de quem rolou tocaria o mesmo resultado duas vezes seguidas). Set simples,
 *  sem limpeza ativa: poucas rolagens por sessão, memória irrelevante. */
const idsProprios = new Set<string>();

export function marcarComoProprio(id: string): void {
  idsProprios.add(id);
}

export function ehRolagemPropria(id: string): boolean {
  return idsProprios.has(id);
}
