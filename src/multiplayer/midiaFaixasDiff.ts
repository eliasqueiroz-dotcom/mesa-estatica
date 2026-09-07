import type { FaixaMidia } from '../state/types';
import { computarDiffPorId, type DiffPorId } from './diffPorId';

export type DiffFaixas = DiffPorId<FaixaMidia>;

/** Compara a lista anterior com a atual e retorna o que precisa subir pro servidor —
 *  mesma base de `tokensDiff.ts` (`diffPorId.ts`). */
export function computarDiffFaixas(anteriores: FaixaMidia[], atuais: FaixaMidia[]): DiffFaixas {
  return computarDiffPorId(
    anteriores,
    atuais,
    (anterior, faixa) =>
      anterior.nome !== faixa.nome ||
      anterior.path !== faixa.path ||
      anterior.url !== faixa.url ||
      anterior.ordem !== faixa.ordem ||
      anterior.tag !== faixa.tag,
  );
}
