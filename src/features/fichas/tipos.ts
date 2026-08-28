import type { Ficha } from '../../state/types';

export interface SecaoFichaProps {
  ficha: Ficha;
  onChange: (patch: Partial<Ficha>) => void;
  /** true só quando o mestre está editando (`FichasTab.tsx`, via `App.tsx`) — controla se as
   *  rolagens desta seção saem privadas por padrão com checkbox, ou sempre públicas sem
   *  checkbox (jogador, `PlayerApp.tsx`). Ausente/false preserva o comportamento do jogador. */
  souMestre?: boolean;
}
