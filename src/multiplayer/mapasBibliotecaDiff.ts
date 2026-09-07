import type { MapaBiblioteca } from '../state/types';
import { computarDiffPorId, type DiffPorId } from './diffPorId';

export type DiffMapas = DiffPorId<MapaBiblioteca>;

/** Compara a lista anterior com a atual e retorna o que precisa subir pro servidor — mesma base
 *  de `midiaFaixasDiff.ts` (`diffPorId.ts`). `grade`/`fow` comparam por REFERÊNCIA, não por
 *  valor: toda ação de grid/FoW (`store.ts: patchMapaAtivo`/`patchFowAtivo`) só troca a
 *  referência do item que mudou de verdade, mantendo os outros intactos — mesmo princípio já
 *  documentado em `fowSync.ts`/`FoWViewOverlay.tsx` (`RegiaoFoW` imutável por troca de
 *  referência). */
export function computarDiffMapas(anteriores: MapaBiblioteca[], atuais: MapaBiblioteca[]): DiffMapas {
  return computarDiffPorId(
    anteriores,
    atuais,
    (anterior, mapa) =>
      anterior.nome !== mapa.nome ||
      anterior.imagemPath !== mapa.imagemPath ||
      anterior.imagemUrl !== mapa.imagemUrl ||
      anterior.ordem !== mapa.ordem ||
      anterior.grade !== mapa.grade ||
      anterior.fow !== mapa.fow,
  );
}
