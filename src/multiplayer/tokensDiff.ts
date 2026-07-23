import type { TokenMapa } from '../state/types';

export interface DiffTokens {
  upserts: TokenMapa[];
  removidos: string[];
}

/** Compara a lista anterior com a atual e retorna o que precisa subir pro servidor. */
export function computarDiffTokens(anteriores: TokenMapa[], atuais: TokenMapa[]): DiffTokens {
  const porId = new Map(anteriores.map((t) => [t.id, t]));
  const idsAtuais = new Set(atuais.map((t) => t.id));

  const upserts = atuais.filter((token) => {
    const anterior = porId.get(token.id);
    return (
      !anterior ||
      anterior.x !== token.x ||
      anterior.y !== token.y ||
      anterior.participanteId !== token.participanteId ||
      anterior.tipo !== token.tipo
    );
  });

  const removidos = anteriores.filter((t) => !idsAtuais.has(t.id)).map((t) => t.id);

  return { upserts, removidos };
}
