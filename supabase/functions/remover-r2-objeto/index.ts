// Edge Function `remover-r2-objeto` (extensão de .claude/docs/storage-r2.md Parte 1 — o doc
// original só cobria upload).
//
// Contraparte de `presign-r2-upload`: apaga um objeto do R2. Diferente do upload (que só
// assina uma URL pro navegador fazer o PUT direto), aqui a function já tem as credenciais
// admin e executa o DELETE ela mesma via aws4fetch — sem URL assinada de volta, um passo só.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// mesmos prefixos liberados de `presign-r2-upload` — mantenha as duas listas em sincronia.
const PREFIXOS_PERMITIDOS = ['sfx/'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ erro: 'método não permitido' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ erro: 'sem autenticação' }, 401);

  let body: { path?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ erro: 'corpo inválido' }, 400);
  }
  const { path } = body;
  if (!path) return jsonResponse({ erro: 'path ausente' }, 400);
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
  if (!mestre) return jsonResponse({ erro: 'só o mestre remove mídia' }, 403);

  const accountId = Deno.env.get('R2_ACCOUNT_ID')!;
  const bucket = Deno.env.get('R2_BUCKET_NAME')!;
  const r2 = new AwsClient({
    accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
    secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
    service: 's3',
    region: 'auto',
  });

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${path}`;
  // 404 conta como sucesso — idempotente (excluir de novo, ou objeto que já não existia, não é erro).
  const resposta = await r2.fetch(endpoint, { method: 'DELETE' });
  if (!resposta.ok && resposta.status !== 404) {
    return jsonResponse({ erro: 'delete falhou' }, 502);
  }

  return jsonResponse({ ok: true }, 200);
});
