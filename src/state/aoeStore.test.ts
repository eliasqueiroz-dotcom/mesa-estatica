import { beforeEach, describe, expect, it } from 'vitest';
import { useAoeStore, type AoeVivo } from './aoeStore';

const criarTemplate = (overrides: Partial<AoeVivo> = {}): AoeVivo => ({
  forma: 'circulo',
  origem: { x: 0.2, y: 0.2 },
  alvo: { x: 0.3, y: 0.3 },
  ativa: true,
  ...overrides,
});

beforeEach(() => {
  useAoeStore.setState({ template: null });
});

describe('definirTemplate', () => {
  it('começa nulo', () => {
    expect(useAoeStore.getState().template).toBeNull();
  });

  it('define um template novo', () => {
    useAoeStore.getState().definirTemplate(criarTemplate());
    expect(useAoeStore.getState().template).toEqual(criarTemplate());
  });

  it('substitui o template existente em vez de acumular — só um por vez', () => {
    useAoeStore.getState().definirTemplate(criarTemplate({ forma: 'circulo' }));
    useAoeStore.getState().definirTemplate(criarTemplate({ forma: 'quadrado' }));
    expect(useAoeStore.getState().template?.forma).toBe('quadrado');
  });

  it('atualiza o alvo durante o arrasto mantendo ativa:true', () => {
    useAoeStore.getState().definirTemplate(criarTemplate({ alvo: { x: 0.3, y: 0.3 }, ativa: true }));
    useAoeStore.getState().definirTemplate(criarTemplate({ alvo: { x: 0.5, y: 0.5 }, ativa: true }));
    expect(useAoeStore.getState().template).toMatchObject({ alvo: { x: 0.5, y: 0.5 }, ativa: true });
  });

  it('marca ativa:false ao soltar o ponteiro', () => {
    useAoeStore.getState().definirTemplate(criarTemplate({ ativa: true }));
    useAoeStore.getState().definirTemplate({ ...useAoeStore.getState().template!, ativa: false });
    expect(useAoeStore.getState().template?.ativa).toBe(false);
  });

  it('limpar (null) some com o template', () => {
    useAoeStore.getState().definirTemplate(criarTemplate());
    useAoeStore.getState().definirTemplate(null);
    expect(useAoeStore.getState().template).toBeNull();
  });
});
