// Edge Function `gerenciar-fila-forcada` (mesa-estatica-multiplayer-completo.md §11 Fase D)
//
// Único jeito de mexer em `forced_queue` a partir de um cliente — a tabela em si não
// tem NENHUMA policy (nem pro GM), de propósito (§13: "a tabela não existe do ponto
// de vista do cliente"). Só quem já é GM (checado via `mestres`, mesma tabela que
// is_gm() usa) consegue listar/adicionar/remover/limpar, e só através desta função.
//
// Substitui o `enfileirarForcado`/`removerForcado`/`limparForcados` locais
// (src/dice/forcarRolagem.ts, via BroadcastChannel) SÓ quando a Fase D estiver
// ativada no cliente (flag `VITE_FASE_D_ROLAGEM_REMOTA`) — por padrão continua
// desligada, o `#controle` local não muda.

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

  let body: { acao?: string; character_id?: string | null; valores?: number[]; id?: string };
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
  if (!mestre) return jsonResponse({ erro: 'só o mestre mexe na fila forçada' }, 403);

  if (acao === 'listar') {
    const { data, error } = await admin
      .from('forced_queue')
      .select('id, character_id, valores, criado_em')
      .eq('consumido', false)
      .order('criado_em', { ascending: true });
    if (error) return jsonResponse({ erro: 'falha ao listar' }, 500);
    return jsonResponse({ fila: data }, 200);
  }

  if (acao === 'adicionar') {
    if (!Array.isArray(body.valores) || body.valores.length === 0) return jsonResponse({ erro: 'valores ausentes' }, 400);
    const { data, error } = await admin
      .from('forced_queue')
      .insert({ character_id: body.character_id ?? null, valores: body.valores, criado_por: userData.user.id })
      .select('id, character_id, valores')
      .single();
    if (error) return jsonResponse({ erro: 'falha ao adicionar' }, 500);
    return jsonResponse({ entrada: data }, 200);
  }

  if (acao === 'remover') {
    if (!body.id) return jsonResponse({ erro: 'id ausente' }, 400);
    const { error } = await admin.from('forced_queue').delete().eq('id', body.id);
    if (error) return jsonResponse({ erro: 'falha ao remover' }, 500);
    return jsonResponse({ ok: true }, 200);
  }

  if (acao === 'limpar') {
    const { error } = await admin.from('forced_queue').delete().eq('consumido', false);
    if (error) return jsonResponse({ erro: 'falha ao limpar' }, 500);
    return jsonResponse({ ok: true }, 200);
  }

  return jsonResponse({ erro: 'acao desconhecida' }, 400);
});
