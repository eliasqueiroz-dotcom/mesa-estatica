// Edge Function `listar-r2-objetos` (.claude/docs/storage-r2.md Parte 5)
//
// Lista os objetos de um prefixo do R2 (chave, data de modificação, tamanho) — usado hoje pra
// popular a lista de saves em `saves/` no import da nuvem (ImportarNuvemModal.tsx). Mesma
// checagem de GM/prefixo permitido que `presign-r2-upload`/`remover-r2-objeto`.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// mesmos prefixos liberados de `presign-r2-upload`/`remover-r2-objeto` — mantenha as listas em sincronia.
const PREFIXOS_PERMITIDOS = ['sfx/', 'saves/'];

interface ObjetoR2 {
  key: string;
  lastModified: string;
  size: number;
  publicUrl: string;
}

/** Pagina por ListObjectsV2 (S3-compatible) filtrando por `prefix`, extraindo `<Key>`,
 * `<LastModified>` e `<Size>` de cada bloco `<Contents>` via regex — sem DOMParser no runtime
 * edge do Deno; o schema do ListBucketResult é fixo e controlado pela própria AWS/R2, não input
 * de usuário (mesmo raciocínio de `usoAtualBucket` em presign-r2-upload). */
async function listarObjetos(r2: AwsClient, accountId: string, bucket: string, prefixo: string, publicBase: string): Promise<ObjetoR2[]> {
  const objetos: ObjetoR2[] = [];
  let continuationToken: string | undefined;
  do {
    const url = new URL(`https://${accountId}.r2.cloudflarestorage.com/${bucket}`);
    url.searchParams.set('list-type', '2');
    url.searchParams.set('prefix', prefixo);
    if (continuationToken) url.searchParams.set('continuation-token', continuationToken);
    const resposta = await r2.fetch(url.toString());
    if (!resposta.ok) throw new Error(`list falhou: ${resposta.status}`);
    const xml = await resposta.text();
    for (const bloco of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const conteudo = bloco[1];
      const key = conteudo.match(/<Key>([^<]+)<\/Key>/)?.[1];
      const lastModified = conteudo.match(/<LastModified>([^<]+)<\/LastModified>/)?.[1] ?? '';
      const size = Number(conteudo.match(/<Size>(\d+)<\/Size>/)?.[1] ?? 0);
      if (key) objetos.push({ key, lastModified, size, publicUrl: `${publicBase}/${key}` });
    }
    const truncado = /<IsTruncated>true<\/IsTruncated>/.test(xml);
    const tokenMatch = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
    continuationToken = truncado && tokenMatch ? tokenMatch[1] : undefined;
  } while (continuationToken);
  return objetos;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ erro: 'método não permitido' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ erro: 'sem autenticação' }, 401);

  let body: { prefixo?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ erro: 'corpo inválido' }, 400);
  }
  const { prefixo } = body;
  if (!prefixo) return jsonResponse({ erro: 'prefixo ausente' }, 400);
  if (!PREFIXOS_PERMITIDOS.some((p) => prefixo === p || prefixo.startsWith(p))) {
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
  if (!mestre) return jsonResponse({ erro: 'só o mestre lista saves' }, 403);

  const accountId = Deno.env.get('R2_ACCOUNT_ID')!;
  const bucket = Deno.env.get('R2_BUCKET_NAME')!;
  const r2 = new AwsClient({
    accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
    secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
    service: 's3',
    region: 'auto',
  });

  const publicBase = Deno.env.get('R2_PUBLIC_BASE_URL')!;
  let objetos: ObjetoR2[];
  try {
    objetos = await listarObjetos(r2, accountId, bucket, prefixo, publicBase);
  } catch {
    return jsonResponse({ erro: 'falha ao listar objetos do R2' }, 502);
  }

  objetos.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
  return jsonResponse({ objetos }, 200);
});
