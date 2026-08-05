// Edge Function `vincular-mestre` (mesa-estatica-multiplayer-completo.md §6, §V.2)
//
// Recebe { gm_token }, compara com o secret GM_TOKEN (nunca embutido no bundle —
// só existe aqui e no que o mestre digita/cola). Se bater, vincula auth.uid() do
// chamador na tabela `mestres`, que as policies RLS de outras tabelas consultam
// via is_gm(). Sem isso não existe "GM: todas" nas policies — é o que resolve
// o problema descrito no doc §6 (a chave anon sozinha não diz quem está chamando).
//
// Rate limit (migração 0022, tabela `mestre_tentativas`): sem isso, alguém que achasse a URL
// publicada podia tentar adivinhar o token indefinidamente, sem custo nenhum. Chave é
// auth_uid (já validado pelo getUser() abaixo), não IP — não dá pra confiar em header de IP
// sem saber o proxy exato na frente da function.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const LIMITE_TENTATIVAS = 5;
const JANELA_BLOQUEIO_MINUTOS = 15;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ erro: 'método não permitido' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ erro: 'sem autenticação' }, 401);

  let gmToken: string | undefined;
  try {
    const body = await req.json();
    gmToken = body.gm_token;
  } catch {
    // corpo inválido — cai no check abaixo
  }
  if (!gmToken) return jsonResponse({ erro: 'gm_token ausente' }, 400);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

  const clienteChamador = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await clienteChamador.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ erro: 'sessão inválida' }, 401);
  const authUid = userData.user.id;

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: registro } = await admin
    .from('mestre_tentativas')
    .select('tentativas, bloqueado_ate')
    .eq('auth_uid', authUid)
    .maybeSingle();

  if (registro?.bloqueado_ate && new Date(registro.bloqueado_ate) > new Date()) {
    return jsonResponse({ erro: 'muitas tentativas — espere um pouco antes de tentar de novo' }, 429);
  }

  if (gmToken !== Deno.env.get('GM_TOKEN')) {
    const tentativas = (registro?.tentativas ?? 0) + 1;
    const bloqueado = tentativas >= LIMITE_TENTATIVAS;
    await admin.from('mestre_tentativas').upsert({
      auth_uid: authUid,
      tentativas: bloqueado ? 0 : tentativas,
      ultima_tentativa: new Date().toISOString(),
      bloqueado_ate: bloqueado ? new Date(Date.now() + JANELA_BLOQUEIO_MINUTOS * 60_000).toISOString() : null,
    });
    return jsonResponse({ erro: 'token inválido' }, 403);
  }

  // sucesso — zera o contador desta identidade.
  if (registro) await admin.from('mestre_tentativas').delete().eq('auth_uid', authUid);

  const { error } = await admin.from('mestres').upsert({ auth_uid: authUid });
  if (error) return jsonResponse({ erro: 'falha ao vincular mestre' }, 500);

  return jsonResponse({ ok: true }, 200);
});
