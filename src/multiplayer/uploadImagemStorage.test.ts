import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

/** Cliente cujo `upload` falha nas primeiras `falhasAntesDoSucesso` chamadas e só então
 *  resolve (ou nunca resolve, se `falhasAntesDoSucesso` for maior que `TENTATIVAS`). */
function criarClienteComFalhasIniciais(falhasAntesDoSucesso: number, urlPublica: string) {
  let chamadas = 0;
  const upload = vi.fn(async () => {
    chamadas++;
    if (chamadas <= falhasAntesDoSucesso) return { error: { message: `falha ${chamadas}` } };
    return { error: null };
  });
  const getPublicUrl = vi.fn(() => ({ data: { publicUrl: urlPublica } }));
  return { storage: { from: vi.fn(() => ({ upload, getPublicUrl })) } };
}

describe('uploadImagemStorage', () => {
  beforeEach(() => {
    h.clienteAtual = null;
  });

  it('sem Supabase configurado (modo local): devolve url null sem tentar upload', async () => {
    h.clienteAtual = null;
    const resultado = await uploadImagemStorage('mapa', new Blob(['x']));
    expect(resultado).toEqual({ url: null });
  });

  it('upload ok: devolve a URL pública, path com prefixo img/ e extensão .jpg', async () => {
    const cliente = criarClienteFalso({ urlPublica: 'https://exemplo.supabase.co/storage/v1/object/public/midia/img/mapa/abc.jpg' });
    h.clienteAtual = cliente;
    const resultado = await uploadImagemStorage('mapa', new Blob(['x']));
    expect(resultado).toEqual({ url: 'https://exemplo.supabase.co/storage/v1/object/public/midia/img/mapa/abc.jpg' });
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

  describe('retry', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('falha nas 2 primeiras tentativas e sucede na 3ª: devolve a URL, upload chamado 3x', async () => {
      const cliente = criarClienteComFalhasIniciais(2, 'https://x/depois-de-2-falhas.jpg');
      h.clienteAtual = cliente;

      const promessa = uploadImagemStorage('mapa', new Blob(['x']));
      await vi.advanceTimersByTimeAsync(2000); // cobre os dois backoffs (400ms + 1200ms)
      const resultado = await promessa;

      expect(resultado).toEqual({ url: 'https://x/depois-de-2-falhas.jpg' });
      expect(cliente.storage.from().upload).toHaveBeenCalledTimes(3);
    });

    it('esgota as 3 tentativas: devolve url null com erro preenchido, upload chamado exatamente 3x', async () => {
      const cliente = criarClienteComFalhasIniciais(99, 'https://nunca-usado.jpg');
      h.clienteAtual = cliente;

      const promessa = uploadImagemStorage('mapa', new Blob(['x']));
      await vi.advanceTimersByTimeAsync(2000);
      const resultado = await promessa;

      expect(resultado.url).toBeNull();
      expect(resultado.erro).toBeTruthy();
      expect(cliente.storage.from().upload).toHaveBeenCalledTimes(3);
    });
  });
});
