// Edge Function `reset-mesa` (ROADMAP.md item 2, Parte A — planejado 25/08).
//
// Zera a mesa inteira no servidor sem depender de is_gm()/GM_TOKEN: valida um `RESET_TOKEN`
// próprio (secret independente, só o dev guarda) e roda com service_role, contornando RLS —
// diferente de hoje, em que "sessão limpa" só apaga no servidor porque quem clica é is_gm() (se
// o mestre trocar o próprio token, ou se o dev quiser limpar produção sem estar logado como
// mestre, aquele caminho para de funcionar).
//
// Faz o que `resetarMesaCompleta()` (src/multiplayer/resetMesa.ts) fazia via diff de sync
// client-side, MAIS a parte que faltava: apaga de fato os arquivos — bucket Storage `midia`
// (imagens de ficha/NPC/mapa) e o prefixo `sfx/` do R2 (soundpad) — e não só as linhas que
// apontam pra eles. `saves/` no R2 fica intocado de propósito: são backups de sessão, apagá-los
// num reset contradiria o propósito de backup. Tabelas de auditoria/identidade (`mestres`,
// `mestre_config`, `mestre_tentativas*`, `vinculo_jogador_log`, `token_tentativas_global`) e
// `forced_queue`/`rolls_log` (não são conteúdo de sessão) ficam fora do alcance, de propósito.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const LIMITE_TENTATIVAS_GLOBAL = 5;
const JANELA_BLOQUEIO_MINUTOS = 15;

// todas usam `id` como PK (conferido migração a migração) — um `.delete().not('id','is',null)`
// uniforme serve tanto pras tabelas de conteúdo quanto pros singletons (sessao_publica,
// mapa_publico, midia_estado, soundpad_estado), mesma lógica de DELETE-não-upsert que
// resetMesa.ts já usa pra fow_estado, agora estendida aos outros três.
const TABELAS_PARA_ESVAZIAR = [
  'characters_publico',
  'characters_privado',
  'npcs_publico',
  'npcs_privado',
  'tokens',
  'midia_faixas',
  'soundpad_sons',
  'iniciativa',
  'log_publico',
  'rolls_publicas',
  'fow_estado',
  'sessao_publica',
  'mapa_publico',
  'midia_estado',
  'soundpad_estado',
];

/** Lista recursivamente um "diretório" do bucket Storage — a API do Supabase Storage só lista
 * um nível por vez, e `midia` tem subpastas por ficha/npc (`img/fichas/{id}/`, `img/npcs/{id}/`). */
async function listarArquivosRecursivo(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  prefixo: string,
): Promise<string[]> {
  const { data: itens } = await admin.storage.from(bucket).list(prefixo, { limit: 1000 });
  if (!itens) return [];
  const caminhos: string[] = [];
  for (const item of itens) {
    const caminho = prefixo ? `${prefixo}/${item.name}` : item.name;
    // pasta = sem metadata (id null); arquivo = tem metadata
    if (item.id === null) {
      caminhos.push(...(await listarArquivosRecursivo(admin, bucket, caminho)));
    } else {
      caminhos.push(caminho);
    }
  }
  return caminhos;
}

/** Pagina por ListObjectsV2 (S3-compatible) — mesma extração por regex de `listar-r2-objetos`
 * (sem DOMParser no runtime edge do Deno; schema do ListBucketResult é controlado pela AWS/R2). */
async function listarChavesR2(r2: AwsClient, accountId: string, bucket: string, prefixo: string): Promise<string[]> {
  const chaves: string[] = [];
  let continuationToken: string | undefined;
  do {
    const url = new URL(`https://${accountId}.r2.cloudflarestorage.com/${bucket}`);
    url.searchParams.set('list-type', '2');
    url.searchParams.set('prefix', prefixo);
    if (continuationToken) url.searchParams.set('continuation-token', continuationToken);
    const resposta = await r2.fetch(url.toString());
    if (!resposta.ok) throw new Error(`list falhou: ${resposta.status}`);
    const xml = await resposta.text();
    for (const bloco of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const key = bloco[1].match(/<Key>([^<]+)<\/Key>/)?.[1];
      if (key) chaves.push(key);
    }
    const truncado = /<IsTruncated>true<\/IsTruncated>/.test(xml);
    const tokenMatch = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
    continuationToken = truncado && tokenMatch ? tokenMatch[1] : undefined;
  } while (continuationToken);
  return chaves;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ erro: 'método não permitido' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ erro: 'sem autenticação' }, 401);

  let body: { reset_token?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ erro: 'corpo inválido' }, 400);
  }
  const { reset_token: resetToken } = body;
  if (!resetToken) return jsonResponse({ erro: 'reset_token ausente' }, 400);

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
    .eq('chave', 'reset-mesa')
    .maybeSingle();
  if (registroGlobal?.bloqueado_ate && new Date(registroGlobal.bloqueado_ate) > new Date()) {
    return jsonResponse({ erro: 'muitas tentativas — espere um pouco antes de tentar de novo' }, 429);
  }

  const resetTokenEsperado = Deno.env.get('RESET_TOKEN');
  if (!resetTokenEsperado) return jsonResponse({ erro: 'RESET_TOKEN não configurado no projeto' }, 500);

  if (resetToken !== resetTokenEsperado) {
    await admin.rpc('registrar_tentativa_token_global', {
      p_chave: 'reset-mesa',
      p_limite: LIMITE_TENTATIVAS_GLOBAL,
      p_janela_minutos: JANELA_BLOQUEIO_MINUTOS,
    });
    return jsonResponse({ erro: 'token inválido' }, 403);
  }
  await admin.rpc('zerar_tentativa_token_global', { p_chave: 'reset-mesa' });

  // 1. tabelas — `.not('id','is',null)` é a condição sempre-verdadeira que o PostgREST exige
  //    pra aceitar um delete sem filtro.
  for (const tabela of TABELAS_PARA_ESVAZIAR) {
    const { error } = await admin.from(tabela).delete().not('id', 'is', null);
    if (error) console.error(`[reset-mesa] limpar ${tabela} falhou`, error);
  }

  // 2. bucket Storage `midia` — imagens de mapa/npc/ficha.
  try {
    const arquivos = await listarArquivosRecursivo(admin, 'midia', '');
    if (arquivos.length > 0) {
      const { error } = await admin.storage.from('midia').remove(arquivos);
      if (error) console.error('[reset-mesa] limpar bucket midia falhou', error);
    }
  } catch (e) {
    console.error('[reset-mesa] listar bucket midia falhou', e);
  }

  // 3. R2 — só `sfx/` (soundpad). `saves/` (backups) fica intocado de propósito.
  const accountId = Deno.env.get('R2_ACCOUNT_ID');
  const bucketR2 = Deno.env.get('R2_BUCKET_NAME');
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
  if (accountId && bucketR2 && accessKeyId && secretAccessKey) {
    const r2 = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
    try {
      const chaves = await listarChavesR2(r2, accountId, bucketR2, 'sfx/');
      for (const chave of chaves) {
        const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucketR2}/${chave}`;
        const resposta = await r2.fetch(endpoint, { method: 'DELETE' });
        if (!resposta.ok && resposta.status !== 404) {
          console.error(`[reset-mesa] apagar R2 ${chave} falhou`, resposta.status);
        }
      }
    } catch (e) {
      console.error('[reset-mesa] limpar R2 sfx/ falhou', e);
    }
  }

  return jsonResponse({ ok: true }, 200);
});
