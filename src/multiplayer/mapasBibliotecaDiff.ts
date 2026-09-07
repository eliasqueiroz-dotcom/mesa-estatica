import type { MapaBiblioteca } from '../state/types';

export interface DiffMapas {
  upserts: MapaBiblioteca[];
  removidos: string[];
}

/** Compara a lista anterior com a atual e retorna o que precisa subir pro servidor — mesmo
 *  formato de `midiaFaixasDiff.ts`. `grade`/`fow` comparam por REFERÊNCIA, não por valor: toda
 *  ação de grid/FoW (`store.ts: patchMapaAtivo`/`patchFowAtivo`) só troca a referência do item
 *  que mudou de verdade, mantendo os outros intactos — mesmo princípio já documentado em
 *  `fowSync.ts`/`FoWViewOverlay.tsx` (`RegiaoFoW` imutável por troca de referência). */
export function computarDiffMapas(anteriores: MapaBiblioteca[], atuais: MapaBiblioteca[]): DiffMapas {
  const porId = new Map(anteriores.map((m) => [m.id, m]));
  const idsAtuais = new Set(atuais.map((m) => m.id));

  const upserts = atuais.filter((mapa) => {
    const anterior = porId.get(mapa.id);
    return (
      !anterior ||
      anterior.nome !== mapa.nome ||
      anterior.imagemPath !== mapa.imagemPath ||
      anterior.imagemUrl !== mapa.imagemUrl ||
      anterior.ordem !== mapa.ordem ||
      anterior.grade !== mapa.grade ||
      anterior.fow !== mapa.fow
    );
  });

  const removidos = anteriores.filter((m) => !idsAtuais.has(m.id)).map((m) => m.id);

  return { upserts, removidos };
}
