// Edge Function `vincular-mestre` (mesa-estatica-multiplayer-completo.md §6, §V.2)
//
// Recebe { gm_token }, compara com o secret GM_TOKEN (nunca embutido no bundle —
// só existe aqui e no que o mestre digita/cola). Se bater, vincula auth.uid() do
// chamador na tabela `mestres`, que as policies RLS de outras tabelas consultam
// via is_gm(). Sem isso não existe "GM: todas" nas policies — é o que resolve
// o problema descrito no doc §6 (a chave anon sozinha não diz quem está chamando).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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
  if (gmToken !== Deno.env.get('GM_TOKEN')) return jsonResponse({ erro: 'token inválido' }, 403);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

  const clienteChamador = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await clienteChamador.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ erro: 'sessão inválida' }, 401);
  const authUid = userData.user.id;

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { error } = await admin.from('mestres').upsert({ auth_uid: authUid });
  if (error) return jsonResponse({ erro: 'falha ao vincular mestre' }, 500);

  return jsonResponse({ ok: true }, 200);
});
