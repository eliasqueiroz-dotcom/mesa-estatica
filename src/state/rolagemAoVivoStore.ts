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
  /** modificador plano somado ao(s) dado(s) (perícia+atributo, bônus manual...) — não é um
   *  dado, não passa pela física; só entra no total mostrado pelo aviso ao vivo
   *  (`formatarNotacaoResultado`). Ausente/undefined quando a rolagem não tem bônus. */
  bonus?: number;
}

interface RolagemAoVivoState {
  atual: RolagemAoVivo | null;
  definirAtual: (r: RolagemAoVivo | null) => void;
  /** Espelha o `visivel` de `RolagemAoVivoPlayer.tsx` (dado rolando + graça mostrando o
   *  resultado) — `atual` nunca volta a `null` sozinho, então não serve pra saber se o aviso
   *  ainda está em tela; `mostrando` é o que outros lugares (destaque da aba "Dados" em
   *  `App.tsx`/`PlayerApp.tsx`) devem ler pra saber quando desligar o realce. */
  mostrando: boolean;
  definirMostrando: (v: boolean) => void;
}

/**
 * Store separado do `useStore` principal — de propósito SEM `persist`, mesmo motivo de
 * `aoeStore.ts`/`pingsStore.ts`: é estado de interação ao vivo (um jogador rolando agora), não
 * estado da mesa; não pode vazar pro localStorage nem pro export/import JSON.
 *
 * Por padrão, só os componentes do JOGADOR (`DadosTabJogador.tsx`, `QuickRollOverlayJogador.tsx`)
 * chamam `definirAtual` — o mestre normalmente nunca publica a própria rolagem aqui, só lê via
 * `RolagemAoVivoPlayer.tsx` (a tela dele já é compartilhada por Discord, não precisa do
 * broadcast pra ser vista). Mesmo sigilo por bundle já usado no projeto, não uma trava de
 * runtime.
 *
 * Exceção deliberada: dano de arma de PC rolado pela aba Combate (`rolarDanoArmaFicha` em
 * `rules/armasCombate.ts`) publica dos dois lados, mestre incluído — é uma ação de PC (sempre
 * pública), e quem estiver conectado no próprio app deve ver o dado caindo mesmo sem estar
 * olhando a tela do mestre.
 */
export const useRolagemAoVivoStore = create<RolagemAoVivoState>((set) => ({
  atual: null,
  definirAtual: (r) => set({ atual: r }),
  mostrando: false,
  definirMostrando: (v) => set({ mostrando: v }),
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
