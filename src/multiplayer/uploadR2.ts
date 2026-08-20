import { supabase } from '../lib/supabaseClient';

export interface ResultadoUploadR2 {
  url: string | null;
  /** mensagem específica do erro (ex.: cota do R2 cheia) quando dá pra extrair da resposta da
   * Edge Function — ausente quando a falha não veio com uma mensagem própria. */
  erro?: string;
}

/** Tenta extrair `{ erro }` do corpo da resposta HTTP de um `FunctionsHttpError` (supabase-js
 * expõe a Response original em `error.context`) — cai em `undefined` se não der. Exportada
 * porque `SoundpadGrid.tsx` reusa pra mostrar o mesmo tipo de erro específico (ex.: cota do R2)
 * quando chama `buscar-freesound` direto, sem passar por `uploadR2`. */
export async function extrairMensagemErro(error: unknown): Promise<string | undefined> {
  const contexto = (error as { context?: Response } | null)?.context;
  if (!(contexto instanceof Response)) return undefined;
  try {
    const corpo = await contexto.clone().json();
    return typeof corpo?.erro === 'string' ? corpo.erro : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Sobe um blob pro Cloudflare R2 via URL assinada (Edge Function `presign-r2-upload`) — o
 * upload em si vai direto do navegador pro R2, só a assinatura passa pelo Supabase. Devolve
 * `{ url }` (ou `url: null` em qualquer falha — sem Supabase configurado, presign negado, PUT
 * falhou), com `erro` preenchido quando a Edge Function mandou um motivo específico (ex.: cota
 * do R2 quase cheia) — quem chama decide o fallback/mensagem.
 */
export async function uploadR2(path: string, arquivo: Blob, tipo: string): Promise<ResultadoUploadR2> {
  const cliente = supabase;
  if (!cliente) return { url: null };

  const { data, error } = await cliente.functions.invoke<{ uploadUrl: string; publicUrl: string }>(
    'presign-r2-upload',
    { body: { path, tipo, tamanho: arquivo.size } },
  );
  if (error || !data) {
    console.error('[uploadR2] presign falhou', error);
    return { url: null, erro: await extrairMensagemErro(error) };
  }

  const resposta = await fetch(data.uploadUrl, { method: 'PUT', body: arquivo, headers: { 'Content-Type': tipo } });
  if (!resposta.ok) {
    console.error('[uploadR2] PUT falhou', resposta.status);
    return { url: null };
  }
  return { url: data.publicUrl };
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
