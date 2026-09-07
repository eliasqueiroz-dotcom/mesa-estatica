import { describe, expect, it } from 'vitest';
import { criarFoWVazio, criarGradeInicial } from '../state/factories';
import type { MapaBiblioteca } from '../state/types';
import { computarDiffMapas } from './mapasBibliotecaDiff';

// referências ESTÁVEIS — duas chamadas de `mapa()` sem override de grade/fow devem apontar pro
// MESMO objeto (mesmo princípio real: só o item patcheado troca de referência, ver
// `mapasBibliotecaSync.ts`). Chamar `criarGradeInicial()`/`criarFoWVazio()` dentro de `mapa()`
// geraria um objeto novo a cada chamada e quebraria os testes de "nada mudou".
const GRADE_PADRAO = criarGradeInicial();
const FOW_PADRAO = criarFoWVazio();

const mapa = (over: Partial<MapaBiblioteca> = {}): MapaBiblioteca => ({
  id: 'a',
  nome: 'mapa 1',
  imagemPath: 'img/mapas/abc.jpg',
  imagemUrl: 'https://exemplo.test/mapas/abc.jpg',
  grade: GRADE_PADRAO,
  fow: FOW_PADRAO,
  ordem: 0,
  criadoEm: '2026-07-24T00:00:00.000Z',
  ...over,
});

describe('computarDiffMapas', () => {
  it('sem mudança nenhuma: upserts e removidos vazios', () => {
    const lista = [mapa()];
    expect(computarDiffMapas(lista, lista)).toEqual({ upserts: [], removidos: [] });
  });

  it('mapa novo entra em upserts', () => {
    const diff = computarDiffMapas([], [mapa()]);
    expect(diff.upserts).toEqual([mapa()]);
    expect(diff.removidos).toEqual([]);
  });

  it('mapa removido entra em removidos, não em upserts', () => {
    const anteriores = [mapa({ id: 'a' }), mapa({ id: 'b' })];
    const atuais = [mapa({ id: 'a' })];
    const diff = computarDiffMapas(anteriores, atuais);
    expect(diff.upserts).toEqual([]);
    expect(diff.removidos).toEqual(['b']);
  });

  it('mudança de nome conta como upsert', () => {
    const anteriores = [mapa({ nome: 'antigo' })];
    const atuais = [mapa({ nome: 'novo' })];
    expect(computarDiffMapas(anteriores, atuais).upserts).toEqual(atuais);
  });

  it('grade com a MESMA referência não conta como upsert — só a troca de objeto conta (patchMapaAtivo em store.ts)', () => {
    const grade = criarGradeInicial();
    const anteriores = [mapa({ grade })];
    const atuais = [mapa({ grade })];
    expect(computarDiffMapas(anteriores, atuais).upserts).toEqual([]);
  });

  it('grade com referência NOVA conta como upsert, mesmo com valores iguais', () => {
    const anteriores = [mapa({ grade: criarGradeInicial() })];
    const atuais = [mapa({ grade: criarGradeInicial() })];
    expect(computarDiffMapas(anteriores, atuais).upserts).toEqual(atuais);
  });

  it('fow com referência nova conta como upsert', () => {
    const anteriores = [mapa({ fow: criarFoWVazio() })];
    const atuais = [mapa({ fow: { ...criarFoWVazio(), ativa: true } })];
    expect(computarDiffMapas(anteriores, atuais).upserts).toEqual(atuais);
  });

  it('mudança só de imagemUrl conta como upsert', () => {
    const anteriores = [mapa({ imagemUrl: 'https://x/antiga.jpg' })];
    const atuais = [mapa({ imagemUrl: 'https://x/nova.jpg' })];
    expect(computarDiffMapas(anteriores, atuais).upserts).toEqual(atuais);
  });
});
