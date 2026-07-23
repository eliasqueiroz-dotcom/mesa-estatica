// Edge Function `vincular-jogador` (mesa-estatica-multiplayer-completo.md §6, §V.2)
//
// Recebe { owner_token }, resolve quem está chamando pelo JWT anônimo (Authorization
// header, já injetado pelo supabase.functions.invoke), e vincula auth.uid() à linha
// de characters_privado dona daquele owner_token. Reatribuível de propósito: o token
// é o credencial (doc §6) — trocar de aparelho com o mesmo link revincula sem drama.
// Roda com service_role só aqui dentro; nunca sai desta função.

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

  let ownerToken: string | undefined;
  try {
    const body = await req.json();
    ownerToken = body.owner_token;
  } catch {
    // corpo inválido — cai no check abaixo
  }
  if (!ownerToken) return jsonResponse({ erro: 'owner_token ausente' }, 400);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

  // cliente "do chamador" — só pra descobrir quem é o dono do JWT anônimo recebido
  const clienteChamador = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await clienteChamador.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ erro: 'sessão inválida' }, 401);
  const authUid = userData.user.id;

  // cliente com privilégio total — service_role nunca sai desta função
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: linha, error: buscaError } = await admin
    .from('characters_privado')
    .select('id')
    .eq('owner_token', ownerToken)
    .maybeSingle();

  if (buscaError || !linha) return jsonResponse({ erro: 'link inválido' }, 404);

  const { error: updateError } = await admin
    .from('characters_privado')
    .update({ auth_uid: authUid })
    .eq('id', linha.id);

  if (updateError) return jsonResponse({ erro: 'falha ao vincular' }, 500);

  return jsonResponse({ ok: true, characterId: linha.id }, 200);
});
