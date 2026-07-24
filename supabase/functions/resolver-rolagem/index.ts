// Edge Function `resolver-rolagem` (mesa-estatica-multiplayer-completo.md §5)
//
// Único lugar que decide se uma rolagem é honesta ou forçada. Recebe
// { character_id, termos: [{ qty, sides }] }, procura em forced_queue uma
// entrada não consumida pra aquele character_id (ou curinga, character_id
// null = "próxima rolagem, de qualquer um"); se achar, usa e marca consumida;
// se não, gera valores honestos com crypto (não Math.random). Sempre grava
// em rolls_log (público). O cliente recebe só { valores, total } — nunca um
// campo "forcado: true/false".
//
// AINDA NÃO CONECTADO à rolagem ao vivo do app (useDiceBox.ts continua no
// caminho local síncrono, validado e em uso pra sessão de 25/07). Essa
// função é a infraestrutura da Fase D (corte do #controle), testada
// isoladamente — ligar na UI é trabalho futuro, com tempo pra testar em
// dois aparelhos reais antes de ir ao ar.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

interface Termo {
  qty: number;
  sides: number;
}

/** Inteiro uniforme em [1, lados] via crypto — não Math.random. */
function rolarHonesto(lados: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % lados) + 1;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ erro: 'método não permitido' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ erro: 'sem autenticação' }, 401);

  let characterId: string | null = null;
  let termos: Termo[] = [];
  try {
    const body = await req.json();
    characterId = body.character_id ?? null;
    termos = body.termos;
    if (!Array.isArray(termos) || termos.length === 0) throw new Error();
  } catch {
    return jsonResponse({ erro: 'termos ausentes/inválidos' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

  const clienteChamador = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await clienteChamador.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ erro: 'sessão inválida' }, 401);

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const totalDados = termos.reduce((n, t) => n + t.qty, 0);

  // procura entrada não consumida pro personagem, ou curinga (character_id null)
  let query = admin.from('forced_queue').select('id, valores').eq('consumido', false).order('criado_em', { ascending: true });
  query = characterId
    ? query.or(`character_id.eq.${characterId},character_id.is.null`)
    : query.is('character_id', null);
  const { data: entrada } = await query.limit(1).maybeSingle();

  let valores: number[];
  if (entrada) {
    const brutos = entrada.valores as number[];
    valores = Array.from({ length: totalDados }, (_, i) => brutos[i] ?? brutos[brutos.length - 1]);
    await admin.from('forced_queue').update({ consumido: true }).eq('id', entrada.id);
  } else {
    valores = [];
    for (const t of termos) {
      for (let i = 0; i < t.qty; i++) valores.push(rolarHonesto(t.sides));
    }
  }

  const total = valores.reduce((a, b) => a + b, 0);
  const formula = termos.map((t) => `${t.qty}d${t.sides}`).join('+');

  await admin.from('rolls_log').insert({ character_id: characterId, formula, valores, total });

  return jsonResponse({ valores, total }, 200);
});
