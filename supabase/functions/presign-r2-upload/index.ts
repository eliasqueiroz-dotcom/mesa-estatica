// Edge Function `presign-r2-upload` (.claude/docs/storage-r2.md Parte 1)
//
// Devolve uma URL assinada (PUT) pro Cloudflare R2 — o upload em si é feito direto do
// navegador pro R2, essa function só autentica o chamador e assina a URL. Mesma checagem de
// GM que as outras functions (via `mestres`), restrita aos prefixos em PREFIXOS_PERMITIDOS.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// prefixos liberados hoje — adicione 'img/mapa/' se um dia migrar mapas também (storage-r2.md).
// mantenha em sincronia com PREFIXOS_PERMITIDOS de `remover-r2-objeto` e `listar-r2-objetos`.
const PREFIXOS_PERMITIDOS = ['sfx/', 'saves/'];

// 8GB — margem de segurança abaixo do free tier de 10GB do R2 (acima disso a Cloudflare cobra).
// checa só ESTE bucket: se a conta Cloudflare tiver outros buckets R2, o uso total da conta
// pode passar de 8GB sem essa trava perceber (o free tier é por conta, não por bucket).
const LIMITE_BYTES = 8 * 1024 ** 3;

/** Soma o Content-Length de todos os objetos do bucket via ListObjectsV2 (S3-compatible),
 * paginando por continuation-token. A resposta é XML — sem DOMParser no runtime edge do Deno,
 * então extrai as tags <Size>/<IsTruncated>/<NextContinuationToken> com regex simples (o schema
 * do ListBucketResult é fixo e controlado pela própria AWS/R2, não input de usuário). */
async function usoAtualBucket(r2: AwsClient, accountId: string, bucket: string): Promise<number> {
  let total = 0;
  let continuationToken: string | undefined;
  do {
    const url = new URL(`https://${accountId}.r2.cloudflarestorage.com/${bucket}`);
    url.searchParams.set('list-type', '2');
    if (continuationToken) url.searchParams.set('continuation-token', continuationToken);
    const resposta = await r2.fetch(url.toString());
    if (!resposta.ok) throw new Error(`list falhou: ${resposta.status}`);
    const xml = await resposta.text();
    for (const m of xml.matchAll(/<Size>(\d+)<\/Size>/g)) total += Number(m[1]);
    const truncado = /<IsTruncated>true<\/IsTruncated>/.test(xml);
    const tokenMatch = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
    continuationToken = truncado && tokenMatch ? tokenMatch[1] : undefined;
  } while (continuationToken);
  return total;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ erro: 'método não permitido' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ erro: 'sem autenticação' }, 401);

  let body: { path?: string; tipo?: string; tamanho?: number };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ erro: 'corpo inválido' }, 400);
  }
  const { path, tipo, tamanho } = body;
  if (!path || !tipo || typeof tamanho !== 'number') return jsonResponse({ erro: 'path/tipo/tamanho ausente' }, 400);
  if (!PREFIXOS_PERMITIDOS.some((p) => path.startsWith(p))) {
    return jsonResponse({ erro: 'prefixo não permitido' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const clienteChamador = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await clienteChamador.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ erro: 'sessão inválida' }, 401);

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: mestre } = await admin.from('mestres').select('auth_uid').eq('auth_uid', userData.user.id).maybeSingle();
  if (!mestre) return jsonResponse({ erro: 'só o mestre sobe mídia' }, 403);

  const accountId = Deno.env.get('R2_ACCOUNT_ID')!;
  const bucket = Deno.env.get('R2_BUCKET_NAME')!;
  const r2 = new AwsClient({
    accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
    secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
    service: 's3',
    region: 'auto',
  });

  try {
    const usoAtual = await usoAtualBucket(r2, accountId, bucket);
    if (usoAtual + tamanho > LIMITE_BYTES) {
      const usadoGB = (usoAtual / 1024 ** 3).toFixed(2);
      const limiteGB = (LIMITE_BYTES / 1024 ** 3).toFixed(0);
      return jsonResponse({ erro: `cota do R2 quase cheia (${usadoGB}GB de ${limiteGB}GB) — apague sons/faixas antigos antes de subir mais` }, 413);
    }
  } catch {
    return jsonResponse({ erro: 'falha ao checar cota do R2' }, 502);
  }

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${path}`;
  const assinada = await r2.sign(
    new Request(endpoint, { method: 'PUT', headers: { 'Content-Type': tipo } }),
    { aws: { signQuery: true } },
  );

  const publicBase = Deno.env.get('R2_PUBLIC_BASE_URL')!;
  return jsonResponse({ uploadUrl: assinada.url, publicUrl: `${publicBase}/${path}` }, 200);
});
