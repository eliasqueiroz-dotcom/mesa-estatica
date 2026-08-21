// Edge Function `converter-ficha-docx` (.claude/docs/storage-r2.md Parte 4)
//
// Relay burro pro OpenRouter: recebe o prompt já pronto (schema + instruções + texto extraído do
// .docx, tudo montado no cliente por `montarPrompt()`), chama a IA gratuita com a chave escondida
// aqui e devolve o texto da resposta puro — quem valida/casa contra as tabelas do jogo é o
// `importarFichasDeJSON` no cliente, igual ao fluxo manual de colar JSON. O .docx em si nunca
// passa por aqui nem pelo Supabase Storage — só o texto extraído (pequeno), que é cota de
// invocação de function, não egress de Storage.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// modelo `:free` padrão do OpenRouter — catálogo de free tier roda com o tempo (confira o atual
// em openrouter.ai/api/v1/models, filtrando id terminado em ":free"), por isso dá pra sobrescrever
// via secret OPENROUTER_MODEL sem precisar reeditar/redeployar o código.
const MODELO_PADRAO = 'openai/gpt-oss-20b:free';

interface Body {
  prompt?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ erro: 'método não permitido' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ erro: 'sem autenticação' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const clienteChamador = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await clienteChamador.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ erro: 'sessão inválida' }, 401);

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: mestre } = await admin.from('mestres').select('auth_uid').eq('auth_uid', userData.user.id).maybeSingle();
  if (!mestre) return jsonResponse({ erro: 'só o mestre importa ficha por IA' }, 403);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ erro: 'corpo inválido' }, 400);
  }
  if (!body.prompt?.trim()) return jsonResponse({ erro: 'prompt ausente' }, 400);

  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) return jsonResponse({ erro: 'importação por IA não configurada neste servidor' }, 501);
  const modelo = Deno.env.get('OPENROUTER_MODEL') || MODELO_PADRAO;

  let resposta: Response;
  try {
    resposta = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelo,
        messages: [{ role: 'user', content: body.prompt }],
        temperature: 0.2,
      }),
    });
  } catch {
    return jsonResponse({ erro: 'falha de rede ao chamar a IA — tenta de novo ou usa o fluxo manual' }, 502);
  }

  if (resposta.status === 429) {
    return jsonResponse({ erro: 'IA gratuita ocupada agora — tenta de novo em instantes ou usa o fluxo manual' }, 429);
  }
  if (!resposta.ok) {
    return jsonResponse({ erro: `IA respondeu com erro (${resposta.status}) — tenta de novo ou usa o fluxo manual` }, 502);
  }

  const dados = await resposta.json();
  const texto = dados?.choices?.[0]?.message?.content;
  if (typeof texto !== 'string' || !texto.trim()) {
    return jsonResponse({ erro: 'IA não devolveu texto — tenta de novo ou usa o fluxo manual' }, 502);
  }

  return jsonResponse({ texto }, 200);
});
