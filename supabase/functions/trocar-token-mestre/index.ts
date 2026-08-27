// Edge Function `trocar-token-mestre` (ROADMAP.md item 2, Parte B — planejado 25/08).
//
// Deixa o mestre trocar o próprio GM_TOKEN sem depender do dev mexer nos secrets do projeto
// Supabase. Não checa is_gm() — a prova de posse é o próprio `token_atual`, validado contra o
// hash em `mestre_config` (ou, se a linha ainda não existir, contra o secret GM_TOKEN de hoje —
// bootstrap único: só nesse primeiro uso o dev, que já conhece o valor atual, faz a troca; o
// mestre troca de novo logo em seguida pra invalidar o que o dev viu).
//
// Rate limit global (migração 0036, tabela `token_tentativas_global`) — sem auth_uid pra
// segmentar (esta function nem exige ser mestre), então a única defesa contra adivinhação por
// força bruta é uma trava global, mesmo raciocínio de vincular-mestre (migração 0024).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const LIMITE_TENTATIVAS_GLOBAL = 10;
const JANELA_BLOQUEIO_MINUTOS = 15;
const TAMANHO_MINIMO_TOKEN_NOVO = 16;

async function sha256Hex(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ erro: 'método não permitido' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ erro: 'sem autenticação' }, 401);

  let body: { token_atual?: string; token_novo?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ erro: 'corpo inválido' }, 400);
  }
  const { token_atual: tokenAtual, token_novo: tokenNovo } = body;
  if (!tokenAtual || !tokenNovo) return jsonResponse({ erro: 'token_atual/token_novo ausente' }, 400);
  if (tokenNovo.length < TAMANHO_MINIMO_TOKEN_NOVO) {
    return jsonResponse({ erro: `token novo precisa ter pelo menos ${TAMANHO_MINIMO_TOKEN_NOVO} caracteres` }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const clienteChamador = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await clienteChamador.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ erro: 'sessão inválida' }, 401);

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: registroGlobal } = await admin
    .from('token_tentativas_global')
    .select('bloqueado_ate')
    .eq('chave', 'trocar-token-mestre')
    .maybeSingle();
  if (registroGlobal?.bloqueado_ate && new Date(registroGlobal.bloqueado_ate) > new Date()) {
    return jsonResponse({ erro: 'muitas tentativas — espere um pouco antes de tentar de novo' }, 429);
  }

  const { data: config } = await admin.from('mestre_config').select('token_hash').eq('id', true).maybeSingle();

  const tokenAtualValido = config
    ? (await sha256Hex(tokenAtual)) === config.token_hash
    : tokenAtual === Deno.env.get('GM_TOKEN');

  if (!tokenAtualValido) {
    await admin.rpc('registrar_tentativa_token_global', {
      p_chave: 'trocar-token-mestre',
      p_limite: LIMITE_TENTATIVAS_GLOBAL,
      p_janela_minutos: JANELA_BLOQUEIO_MINUTOS,
    });
    return jsonResponse({ erro: 'token atual inválido' }, 403);
  }

  const { error } = await admin
    .from('mestre_config')
    .upsert({ id: true, token_hash: await sha256Hex(tokenNovo), atualizado_em: new Date().toISOString() });
  if (error) return jsonResponse({ erro: 'falha ao trocar token' }, 500);

  await admin.rpc('zerar_tentativa_token_global', { p_chave: 'trocar-token-mestre' });

  return jsonResponse({ ok: true }, 200);
});
