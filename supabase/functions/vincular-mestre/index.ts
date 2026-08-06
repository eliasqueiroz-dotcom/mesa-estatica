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
//
// Migração 0024 fechou duas brechas: (1) o incremento agora roda inteiro dentro da function
// Postgres `registrar_tentativa_mestre` (INSERT...ON CONFLICT DO UPDATE, atômico por lock de
// linha) — o antigo "select → soma em JS → upsert" deixava tentativas paralelas lerem o mesmo
// valor velho e nunca travar o limite; (2) uma trava GLOBAL (`registrar_tentativa_mestre_global`,
// linha única) conta falhas de QUALQUER identidade na mesma janela — sem ela, trocar de auth_uid
// (aba anônima nova) resetava as 5 tentativas de graça, indefinidamente.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const LIMITE_TENTATIVAS = 5;
const LIMITE_TENTATIVAS_GLOBAL = 20;
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

  const [{ data: registro }, { data: registroGlobal }] = await Promise.all([
    admin.from('mestre_tentativas').select('bloqueado_ate').eq('auth_uid', authUid).maybeSingle(),
    admin.from('mestre_tentativas_global').select('bloqueado_ate').eq('id', true).maybeSingle(),
  ]);

  const agora = new Date();
  if (registro?.bloqueado_ate && new Date(registro.bloqueado_ate) > agora) {
    return jsonResponse({ erro: 'muitas tentativas — espere um pouco antes de tentar de novo' }, 429);
  }
  if (registroGlobal?.bloqueado_ate && new Date(registroGlobal.bloqueado_ate) > agora) {
    return jsonResponse({ erro: 'muitas tentativas — espere um pouco antes de tentar de novo' }, 429);
  }

  if (gmToken !== Deno.env.get('GM_TOKEN')) {
    // Incremento atômico (migração 0024) — por identidade E global, em paralelo. Cada RPC é uma
    // única instrução SQL (INSERT...ON CONFLICT DO UPDATE / UPDATE sob lock de linha), então
    // tentativas concorrentes nunca leem o mesmo valor "antes" e perdem incremento.
    await Promise.all([
      admin.rpc('registrar_tentativa_mestre', {
        p_auth_uid: authUid,
        p_limite: LIMITE_TENTATIVAS,
        p_janela_minutos: JANELA_BLOQUEIO_MINUTOS,
      }),
      admin.rpc('registrar_tentativa_mestre_global', {
        p_limite: LIMITE_TENTATIVAS_GLOBAL,
        p_janela_minutos: JANELA_BLOQUEIO_MINUTOS,
      }),
    ]);
    return jsonResponse({ erro: 'token inválido' }, 403);
  }

  // sucesso — zera o contador desta identidade.
  if (registro) await admin.from('mestre_tentativas').delete().eq('auth_uid', authUid);

  const { error } = await admin.from('mestres').upsert({ auth_uid: authUid });
  if (error) return jsonResponse({ erro: 'falha ao vincular mestre' }, 500);

  return jsonResponse({ ok: true }, 200);
});
