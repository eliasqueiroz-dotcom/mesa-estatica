import type { CustomColorset } from '@3d-dice/dice-box-threejs';

/**
 * Dois colorsets dos dados (arte.md): `rede` — vidro frio ciano, testes normais.
 * `ruído` — âmbar sujo/vermelho, Sanidade/Surto/Trauma. Números sempre na cor "contrária" da
 * paleta (ciano nos dados de ruído, âmbar nos de rede) — mantém contraste alto nos dois casos
 * e reforça a leitura: o sinal frio sempre corta por baixo do ruído.
 */
export const COLORSETS: Record<'rede' | 'ruido', CustomColorset> = {
  rede: {
    background: '#2a6d78', // --rede-dim
    foreground: '#ffc400', // âmbar vivo
    outline: '#0b0d11', // --void
    texture: 'glass',
    material: 'glass',
  },
  ruido: {
    background: '#5c2d29', // --ruido-dim
    foreground: '#4fc1d4', // --rede, sinal frio cortando o ruído
    outline: '#0b0d11',
    texture: 'glass',
    material: 'glass',
  },
};

export type ColorsetId = keyof typeof COLORSETS;

/** Colorset por jogador: fundo/vidro continua pelo tipo de rolagem (rede/ruído), números saem
 *  na cor do jogador (`ficha.corVisual`) em vez do âmbar/ciano fixo — usado pela sincronização
 *  ao vivo (`rolagemAoVivoStore.ts`) pra quem está vendo saber de quem é o dado. */
export function colorsetComCor(base: ColorsetId, cor: string): CustomColorset {
  return { ...COLORSETS[base], foreground: cor };
}
