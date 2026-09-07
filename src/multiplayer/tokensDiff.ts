import type { TokenMapa } from '../state/types';
import { computarDiffPorId, type DiffPorId } from './diffPorId';

export type DiffTokens = DiffPorId<TokenMapa>;

/** Compara a lista anterior com a atual e retorna o que precisa subir pro servidor. */
export function computarDiffTokens(anteriores: TokenMapa[], atuais: TokenMapa[]): DiffTokens {
  return computarDiffPorId(
    anteriores,
    atuais,
    (anterior, token) =>
      anterior.x !== token.x ||
      anterior.y !== token.y ||
      anterior.participanteId !== token.participanteId ||
      anterior.tipo !== token.tipo,
  );
}
