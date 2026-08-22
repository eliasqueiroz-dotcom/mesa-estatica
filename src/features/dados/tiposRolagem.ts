import type { TipoLog } from '../../state/types';

/** `TipoLog` que representam rolagem de dado — usado pelo feed de rolagens (`FeedRolagens.tsx`/
 *  `FeedRolagensJogador.tsx`) pra filtrar `s.log` sem misturar anotações/dinheiro/iniciativa. */
export const TIPOS_ROLAGEM: TipoLog[] = ['teste', 'sanidade', 'surto', 'trauma', 'rolagem-livre', 'dano'];
