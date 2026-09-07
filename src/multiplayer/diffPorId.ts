export interface DiffPorId<T> {
  upserts: T[];
  removidos: string[];
}

/** Compara a lista anterior com a atual por id e retorna o que precisa subir pro servidor —
 *  base compartilhada de `tokensDiff.ts`/`midiaFaixasDiff.ts`/`mapasBibliotecaDiff.ts`, que só
 *  diferiam nos campos comparados por item. `mudou` decide se um item existente mudou o
 *  suficiente pra entrar em `upserts`; item novo (sem correspondente em `anteriores`) sempre
 *  entra, sem precisar chamar `mudou`. */
export function computarDiffPorId<T extends { id: string }>(
  anteriores: T[],
  atuais: T[],
  mudou: (anterior: T, atual: T) => boolean,
): DiffPorId<T> {
  const porId = new Map(anteriores.map((item) => [item.id, item]));
  const idsAtuais = new Set(atuais.map((item) => item.id));

  const upserts = atuais.filter((item) => {
    const anterior = porId.get(item.id);
    return !anterior || mudou(anterior, item);
  });

  const removidos = anteriores.filter((item) => !idsAtuais.has(item.id)).map((item) => item.id);

  return { upserts, removidos };
}
