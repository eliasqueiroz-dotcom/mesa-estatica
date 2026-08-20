// Edge Function `buscar-freesound` (.claude/docs/storage-r2.md Parte 2)
//
// Busca efeito sonoro no Freesound.org e sobe a prévia escolhida pro R2 — evita caçar/baixar
// arquivo em outro lugar antes de fazer upload manual. Duas ações no corpo (mesmo estilo do
// `acao` de `gerenciar-fila-forcada`): 'buscar' e 'usar'.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// 8GB — mesma trava/constante de `presign-r2-upload` (duplicada aqui, sem pasta `_shared/`,
// mesmo padrão de cópia-e-cola que as outras functions já seguem). Sem isso, subir som via
// Freesound seria um jeito de driblar a cota que o upload manual respeita.
const LIMITE_BYTES = 8 * 1024 ** 3;

/** Idêntica à de `presign-r2-upload` — ver comentário lá pro porquê do parse por regex. */
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

interface ResultadoFreesound {
  id: number;
  name: string;
  duration: number;
  previews: { 'preview-hq-mp3': string };
}

interface Body {
  acao?: 'buscar' | 'usar';
  query?: string;
  slot?: number;
  previewUrl?: string;
  nome?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ erro: 'método não permitido' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ erro: 'sem autenticação' }, 401);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ erro: 'corpo inválido' }, 400);
  }
  const { acao } = body;
  if (!acao) return jsonResponse({ erro: 'acao ausente' }, 400);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const clienteChamador = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await clienteChamador.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ erro: 'sessão inválida' }, 401);

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: mestre } = await admin.from('mestres').select('auth_uid').eq('auth_uid', userData.user.id).maybeSingle();
  if (!mestre) return jsonResponse({ erro: 'só o mestre busca/usa som' }, 403);

  if (acao === 'buscar') {
    if (!body.query) return jsonResponse({ erro: 'query ausente' }, 400);
    const url = new URL('https://freesound.org/apiv2/search/text/');
    url.searchParams.set('query', body.query);
    url.searchParams.set('token', Deno.env.get('FREESOUND_API_KEY')!);
    url.searchParams.set('filter', 'license:"Creative Commons 0"');
    url.searchParams.set('fields', 'id,name,duration,previews');
    url.searchParams.set('page_size', '20');

    const resposta = await fetch(url);
    if (!resposta.ok) return jsonResponse({ erro: 'busca no freesound falhou' }, 502);
    const dados = await resposta.json();
    const resultados = (dados.results as ResultadoFreesound[]).map((r) => ({
      id: r.id,
      nome: r.name,
      duracao: r.duration,
      previewUrl: r.previews['preview-hq-mp3'],
    }));
    return jsonResponse({ resultados }, 200);
  }

  if (acao === 'usar') {
    const { slot, previewUrl, nome } = body;
    if (slot === undefined || !previewUrl || !nome) return jsonResponse({ erro: 'slot/previewUrl/nome ausente' }, 400);

    // download no servidor: o CDN de prévia do Freesound pode não liberar CORS pra fetch() de
    // blob a partir do navegador — só <audio src> dispensa CORS, baixar bytes pra reenviar não.
    const audio = await fetch(previewUrl);
    if (!audio.ok) return jsonResponse({ erro: 'download da prévia falhou' }, 502);
    const blob = await audio.blob();

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
      if (usoAtual + blob.size > LIMITE_BYTES) {
        const usadoGB = (usoAtual / 1024 ** 3).toFixed(2);
        const limiteGB = (LIMITE_BYTES / 1024 ** 3).toFixed(0);
        return jsonResponse({ erro: `cota do R2 quase cheia (${usadoGB}GB de ${limiteGB}GB) — apague sons/faixas antigos antes de subir mais` }, 413);
      }
    } catch {
      return jsonResponse({ erro: 'falha ao checar cota do R2' }, 502);
    }

    const path = `sfx/${crypto.randomUUID()}-freesound.mp3`;
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${path}`;
    // upload direto (não presigned): quem faz o PUT aqui é a própria function, que já tem as
    // credenciais — diferente de presign-r2-upload, que assina só pro NAVEGADOR subir depois.
    const resultado = await r2.fetch(endpoint, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': 'audio/mpeg' },
    });
    if (!resultado.ok) return jsonResponse({ erro: 'upload pro R2 falhou' }, 500);

    const publicBase = Deno.env.get('R2_PUBLIC_BASE_URL')!;
    return jsonResponse({ path, url: `${publicBase}/${path}` }, 200);
  }

  return jsonResponse({ erro: 'acao inválida' }, 400);
});
