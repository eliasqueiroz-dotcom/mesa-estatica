import type { Ficha } from '../../state/types';

export interface SecaoFichaProps {
  ficha: Ficha;
  onChange: (patch: Partial<Ficha>) => void;
}
