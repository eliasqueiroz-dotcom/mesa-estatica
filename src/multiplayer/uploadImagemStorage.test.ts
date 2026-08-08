import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ clienteAtual: null as unknown }));
vi.mock('../lib/supabaseClient', () => ({
  get supabase() {
    return h.clienteAtual;
  },
}));

const { uploadImagemStorage } = await import('./uploadImagemStorage');

function criarClienteFalso(opts: { erroUpload?: { message: string }; urlPublica?: string }) {
  const upload = vi.fn(async () => (opts.erroUpload ? { error: opts.erroUpload } : { error: null }));
  const getPublicUrl = vi.fn(() => ({ data: { publicUrl: opts.urlPublica ?? '' } }));
  return { storage: { from: vi.fn(() => ({ upload, getPublicUrl })) } };
}

describe('uploadImagemStorage', () => {
  beforeEach(() => {
    h.clienteAtual = null;
  });

  it('sem Supabase configurado (modo local): devolve null sem tentar upload', async () => {
    h.clienteAtual = null;
    const resultado = await uploadImagemStorage('mapa', new Blob(['x']));
    expect(resultado).toBeNull();
  });

  it('upload ok: devolve a URL pública, path com prefixo img/ e extensão .jpg', async () => {
    const cliente = criarClienteFalso({ urlPublica: 'https://exemplo.supabase.co/storage/v1/object/public/midia/img/mapa/abc.jpg' });
    h.clienteAtual = cliente;
    const resultado = await uploadImagemStorage('mapa', new Blob(['x']));
    expect(resultado).toBe('https://exemplo.supabase.co/storage/v1/object/public/midia/img/mapa/abc.jpg');
    expect(cliente.storage.from).toHaveBeenCalledWith('midia');
    const chamadaUpload = cliente.storage.from.mock.results[0].value.upload.mock.calls[0];
    expect(chamadaUpload[0]).toMatch(/^img\/mapa\/[0-9a-f-]+\.jpg$/);
    expect(chamadaUpload[2]).toEqual({ contentType: 'image/jpeg' });
  });

  it('respeita a pasta com id do dono (ex.: npcs/{npcId}, fichas/{fichaId})', async () => {
    const cliente = criarClienteFalso({ urlPublica: 'https://x/y.jpg' });
    h.clienteAtual = cliente;
    await uploadImagemStorage('fichas/ficha-1', new Blob(['x']));
    const chamadaUpload = cliente.storage.from.mock.results[0].value.upload.mock.calls[0];
    expect(chamadaUpload[0]).toMatch(/^img\/fichas\/ficha-1\/[0-9a-f-]+\.jpg$/);
  });

  it('upload rejeitado pelo Storage: devolve null, não lança', async () => {
    const cliente = criarClienteFalso({ erroUpload: { message: 'nope' } });
    h.clienteAtual = cliente;
    const resultado = await uploadImagemStorage('mapa', new Blob(['x']));
    expect(resultado).toBeNull();
  });
});
