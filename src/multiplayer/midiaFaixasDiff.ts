import type { FaixaMidia } from '../state/types';

export interface DiffFaixas {
  upserts: FaixaMidia[];
  removidos: string[];
}

/** Compara a lista anterior com a atual e retorna o que precisa subir pro servidor —
 *  mesmo formato de `tokensDiff.ts`. */
export function computarDiffFaixas(anteriores: FaixaMidia[], atuais: FaixaMidia[]): DiffFaixas {
  const porId = new Map(anteriores.map((f) => [f.id, f]));
  const idsAtuais = new Set(atuais.map((f) => f.id));

  const upserts = atuais.filter((faixa) => {
    const anterior = porId.get(faixa.id);
    return (
      !anterior ||
      anterior.nome !== faixa.nome ||
      anterior.path !== faixa.path ||
      anterior.url !== faixa.url ||
      anterior.ordem !== faixa.ordem ||
      anterior.tag !== faixa.tag
    );
  });

  const removidos = anteriores.filter((f) => !idsAtuais.has(f.id)).map((f) => f.id);

  return { upserts, removidos };
}
