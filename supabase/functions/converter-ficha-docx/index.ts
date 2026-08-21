// Edge Function `converter-ficha-docx` (.claude/docs/storage-r2.md Parte 4)
//
// Relay burro pra IA: recebe o prompt já pronto (schema + instruções + texto extraído do
// .docx, tudo montado no cliente por `montarPrompt()`), chama a IA gratuita com a chave escondida
// aqui e devolve o texto da resposta puro — quem valida/casa contra as tabelas do jogo é o
// `importarFichasDeJSON` no cliente, igual ao fluxo manual de colar JSON. O .docx em si nunca
// passa por aqui nem pelo Supabase Storage — só o texto extraído (pequeno), que é cota de
// invocação de function, não egress de Storage.
//
// Groq como primário, OpenRouter como fallback: mesmo modelo (`openai/gpt-oss-20b`) nos dois,
// mas a Groq roda em hardware dedicado a velocidade (LPU) — ~1000 tokens/s documentado, contra o
// pool compartilhado e mais lento do free tier da OpenRouter. Se a Groq falhar (rate limit, fora
// do ar, sem secret configurado), cai pro OpenRouter em vez de devolver erro na hora — mesma API
// compatível com o formato OpenAI nos dois, então é só trocar URL/chave/modelo.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

interface Provedor {
  nome: string;
  url: string;
  apiKey: string | undefined;
  modelo: string;
}

// catálogo/nomes de modelo podem mudar com o tempo em qualquer um dos dois provedores — confira o
// atual em console.groq.com/docs/models e openrouter.ai/api/v1/models (free: filtrar id ":free").
// Por isso GROQ_MODEL/OPENROUTER_MODEL sobrescrevem sem precisar reeditar/redeployar o código.
function provedores(): Provedor[] {
  return [
    {
      nome: 'Groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      apiKey: Deno.env.get('GROQ_API_KEY'),
      modelo: Deno.env.get('GROQ_MODEL') || 'openai/gpt-oss-20b',
    },
    {
      nome: 'OpenRouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: Deno.env.get('OPENROUTER_API_KEY'),
      modelo: Deno.env.get('OPENROUTER_MODEL') || 'openai/gpt-oss-20b:free',
    },
  ];
}

async function tentarProvedor(p: Provedor, prompt: string): Promise<{ texto: string } | { erro: string }> {
  if (!p.apiKey) return { erro: `${p.nome} sem chave configurada` };

  let resposta: Response;
  try {
    resposta = await fetch(p.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${p.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: p.modelo, messages: [{ role: 'user', content: prompt }], temperature: 0.2 }),
    });
  } catch {
    return { erro: `falha de rede ao chamar ${p.nome}` };
  }
  if (!resposta.ok) return { erro: `${p.nome} respondeu com erro (${resposta.status})` };

  const dados = await resposta.json();
  const texto = dados?.choices?.[0]?.message?.content;
  if (typeof texto !== 'string' || !texto.trim()) return { erro: `${p.nome} não devolveu texto` };
  return { texto };
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

  let body: { prompt?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ erro: 'corpo inválido' }, 400);
  }
  if (!body.prompt?.trim()) return jsonResponse({ erro: 'prompt ausente' }, 400);

  for (const p of provedores()) {
    const resultado = await tentarProvedor(p, body.prompt);
    if ('texto' in resultado) return jsonResponse({ texto: resultado.texto }, 200);
    console.error(`[converter-ficha-docx] ${resultado.erro}`);
  }

  return jsonResponse({ erro: 'IA gratuita indisponível agora (Groq e OpenRouter falharam) — tenta de novo em instantes ou usa o fluxo manual' }, 502);
});
