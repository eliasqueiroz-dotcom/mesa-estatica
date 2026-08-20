import { supabase } from '../lib/supabaseClient';

/**
 * Sobe um blob pro Cloudflare R2 via URL assinada (Edge Function `presign-r2-upload`) — o
 * upload em si vai direto do navegador pro R2, só a assinatura passa pelo Supabase. Devolve a
 * URL pública ou `null` em qualquer falha (sem Supabase configurado, presign negado, PUT
 * falhou) — quem chama decide o fallback.
 */
export async function uploadR2(path: string, arquivo: Blob, tipo: string): Promise<string | null> {
  const cliente = supabase;
  if (!cliente) return null;

  const { data, error } = await cliente.functions.invoke<{ uploadUrl: string; publicUrl: string }>(
    'presign-r2-upload',
    { body: { path, tipo } },
  );
  if (error || !data) {
    console.error('[uploadR2] presign falhou', error);
    return null;
  }

  const resposta = await fetch(data.uploadUrl, { method: 'PUT', body: arquivo, headers: { 'Content-Type': tipo } });
  if (!resposta.ok) {
    console.error('[uploadR2] PUT falhou', resposta.status);
    return null;
  }
  return data.publicUrl;
}

/**
 * Contraparte de `uploadR2` — chama a Edge Function `remover-r2-objeto`, que já tem as
 * credenciais admin e apaga o objeto ela mesma (sem passo de URL assinada). `path` deve ter o
 * mesmo prefixo permitido (`sfx/...`) usado no upload.
 */
export async function deletarR2(path: string): Promise<boolean> {
  const cliente = supabase;
  if (!cliente) return false;

  const { data, error } = await cliente.functions.invoke<{ ok: boolean }>('remover-r2-objeto', {
    body: { path },
  });
  if (error || !data?.ok) {
    console.error('[deletarR2] falhou', error);
    return false;
  }
  return true;
}

/** URL pública do Supabase Storage sempre contém esse segmento; URL do R2 nunca contém — usado
 * pra decidir, na exclusão, qual backend um arquivo antigo (pré-migração) ainda ocupa. */
export function isUrlSupabaseStorage(url: string): boolean {
  return url.includes('/storage/v1/object/public/');
}
