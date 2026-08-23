import { describe, expect, it, vi } from 'vitest';
import { inserirOuAtualizarNaCorrida } from './insercaoConcorrente';

describe('inserirOuAtualizarNaCorrida', () => {
  it('só chama inserir quando ele funciona de primeira — nunca chama atualizar', async () => {
    const inserir = vi.fn(() => Promise.resolve({ error: null }));
    const atualizar = vi.fn(() => Promise.resolve({ error: null }));

    await inserirOuAtualizarNaCorrida(inserir, atualizar);

    expect(inserir).toHaveBeenCalledOnce();
    expect(atualizar).not.toHaveBeenCalled();
  });

  it('cai pra atualizar quando o insert esbarra em chave duplicada (23505) — corrida com outro push', async () => {
    const inserir = vi.fn(() => Promise.resolve({ error: { code: '23505', message: 'duplicate key value violates unique constraint' } }));
    const atualizar = vi.fn(() => Promise.resolve({ error: null }));

    await inserirOuAtualizarNaCorrida(inserir, atualizar);

    expect(atualizar).toHaveBeenCalledOnce();
  });

  it('propaga qualquer outro código de erro do insert sem tentar o fallback', async () => {
    const inserir = vi.fn(() => Promise.resolve({ error: { code: '42501', message: 'RLS negou' } }));
    const atualizar = vi.fn();

    await expect(inserirOuAtualizarNaCorrida(inserir, atualizar)).rejects.toMatchObject({ code: '42501' });
    expect(atualizar).not.toHaveBeenCalled();
  });

  it('propaga o erro do update de fallback se ele também falhar', async () => {
    const inserir = vi.fn(() => Promise.resolve({ error: { code: '23505' } }));
    const atualizar = vi.fn(() => Promise.resolve({ error: { code: 'outro', message: 'falhou' } }));

    await expect(inserirOuAtualizarNaCorrida(inserir, atualizar)).rejects.toMatchObject({ code: 'outro' });
  });
});
