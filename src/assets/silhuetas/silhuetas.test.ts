import { describe, expect, it } from 'vitest';
import { SILHUETAS, silhuetaPorSlug } from './silhuetas';

describe('silhuetas', () => {
  it('tem slugs únicos', () => {
    const slugs = SILHUETAS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('resolve um slug existente', () => {
    const def = silhuetaPorSlug('guarda');
    expect(def?.slug).toBe('guarda');
    expect(def?.label).toBe('Guarda');
  });

  it('resolve as categorias novas — trabalhador, entregador, médico e idosa', () => {
    expect(silhuetaPorSlug('trabalhador')?.label).toBe('Trabalhador');
    expect(silhuetaPorSlug('entregador')?.label).toBe('Entregador');
    expect(silhuetaPorSlug('medico')?.label).toBe('Médico');
    expect(silhuetaPorSlug('idosa')?.label).toBe('Senhora idosa');
  });

  it('retorna null para slug inexistente, undefined ou null', () => {
    expect(silhuetaPorSlug('nao-existe')).toBeNull();
    expect(silhuetaPorSlug(undefined)).toBeNull();
    expect(silhuetaPorSlug(null)).toBeNull();
  });
});
