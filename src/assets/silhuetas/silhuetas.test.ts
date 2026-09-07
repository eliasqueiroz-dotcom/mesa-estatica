import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SILHUETAS, silhuetaPorSlug } from './silhuetas';

describe('silhuetas', () => {
  it('tem slugs únicos', () => {
    const slugs = SILHUETAS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('tem labels únicos', () => {
    const labels = SILHUETAS.map((s) => s.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('resolve um slug existente', () => {
    const def = silhuetaPorSlug('guarda');
    expect(def?.slug).toBe('guarda');
    expect(def?.label).toBe('Guarda');
  });

  it('resolve as categorias de trabalho e serviço', () => {
    expect(silhuetaPorSlug('trabalhador')?.label).toBe('Trabalhador');
    expect(silhuetaPorSlug('entregador')?.label).toBe('Entregador');
    expect(silhuetaPorSlug('medico')?.label).toBe('Médico');
    expect(silhuetaPorSlug('idosa')?.label).toBe('Senhora idosa');
  });

  it('resolve as categorias acrescentadas na remodelagem', () => {
    expect(silhuetaPorSlug('seguranca')?.label).toBe('Segurança privada');
    expect(silhuetaPorSlug('crianca')?.label).toBe('Criança');
    expect(silhuetaPorSlug('anomalia')?.label).toBe('Anomalia');
    expect(silhuetaPorSlug('catador')?.label).toBe('Catador');
    expect(silhuetaPorSlug('camelo')?.label).toBe('Camelô');
  });

  it('retorna null para slug inexistente, undefined ou null', () => {
    expect(silhuetaPorSlug('nao-existe')).toBeNull();
    expect(silhuetaPorSlug(undefined)).toBeNull();
    expect(silhuetaPorSlug(null)).toBeNull();
  });

  // arte.md: vermelho sujo é só dano, Sanidade crítica e Surto. Uma silhueta em --ruido
  // roubaria esse sinal — e o erro é fácil de cometer ao acrescentar categoria nova.
  it('nenhuma silhueta usa o vermelho reservado a dano/Sanidade/Surto', () => {
    for (const { slug, Icone } of SILHUETAS) {
      const markup = renderToStaticMarkup(createElement(Icone)).toLowerCase();
      expect(markup, slug).not.toContain('--ruido');
      expect(markup, slug).not.toContain('a8463e');
    }
  });
});
