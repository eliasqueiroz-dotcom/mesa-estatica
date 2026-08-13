# Migração de mídia pro Cloudflare R2

> Guia operacional — não é fonte de regra nem de arquitetura fechada (`arquitetura.md`
> continua sendo isso). Serve pra reduzir o uso de Storage/egress do Supabase movendo os
> assets mais pesados pro R2. Grep pela seção, como os outros docs — não precisa ler
> o arquivo inteiro pra fazer só um passo.

## Por quê

O bucket único `midia` do Supabase (`supabase/migrations/0008_midia.sql`) hospeda hoje áudio
(`sfx/`), imagens de mapa (`img/mapa/`) e fotos de NPC/ficha (`img/npcs/`, `img/fichas/`). O
free tier do Supabase limita **Storage a 1GB total** e cobra egress acima da cota do plano
(confira o valor atual na página de pricing deles — muda com o tempo). O áudio já aceita até
50MB por arquivo **sem nenhuma compressão** (`MidiaTab.tsx`, `SoundpadGrid.tsx`) — é o que mais
pesa, de longe.

O Cloudflare R2 é compatível com a API S3, tem um free tier bem maior (~10GB de storage) e a
vantagem que interessa aqui: **zero taxa de egress, sempre** — ao contrário de S3/Supabase, ler
do R2 não é cobrado por banda.

### Prioridade (não migrar tudo de uma vez)

| Asset | Prefixo | Por quê migrar (ou não) |
|---|---|---|
| **Áudio** (soundpad + jukebox) | `sfx/` | **Fazer primeiro.** Sem compressão, até 50MB/arquivo — é o que estoura a cota e gera mais egress (tocado repetidas vezes numa sessão) |
| Imagem de mapa | `img/mapa/` | **Opcional.** JPEG comprimido a ~1600px, um mapa ativo por vez — porte médio, baixo volume |
| Foto de NPC/ficha | `img/npcs/`, `img/fichas/` | **Não vale a pena.** Avatar 256×256 comprimido, poucos KB cada — mover não reduz egress de forma perceptível e adiciona complexidade (a policy de dono-de-ficha da migração `0031` teria que ser replicada na Edge Function) |

Este guia cobre áudio como obrigatório e marca mapas como opcional em cada passo. Fotos de
NPC/ficha ficam de fora — se um dia quiser migrar também, o Passo 4 explica onde estender.

---

## Passo 1 — criar o bucket no Cloudflare R2

1. Dashboard da Cloudflare → **R2 Object Storage** → **Create bucket**.
2. Nome sugerido: `estatica-midia` (qualquer nome serve, é só referenciado por secret depois).
3. **Acesso público de leitura** — duas opções:
   - **Rápido**: bucket → *Settings* → *Public Development URL* → ativar. Gera algo como
     `https://pub-xxxxxxxx.r2.dev` — tem rate limit, mas é instantâneo e suficiente pra uma
     mesa pequena.
   - **Recomendado se você já tem um domínio na Cloudflare**: bucket → *Settings* → *Custom
     Domains* → conectar um subdomínio (ex.: `midia.seudominio.com`) — sem rate limit, passa
     pelo CDN da Cloudflare.
4. **CORS** — bucket → *Settings* → *CORS Policy* → colar (ajuste a origem pro seu domínio real
   do GitHub Pages, hoje `https://queiroz-labs.github.io`; o app roda sob o base path
   `/mesa-estatica/`, mas CORS é por origem, não por path):

   ```json
   [
     {
       "AllowedOrigins": ["https://queiroz-labs.github.io", "http://localhost:5173"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   Sem isso, o `fetch(uploadUrl, { method: 'PUT', ... })` do Passo 5 falha por CORS — o upload
   é feito **direto do navegador pro R2** (só a URL assinada vem do Supabase), então a origem
   real do app precisa estar na lista.

## Passo 2 — gerar credenciais de API (S3-compatible)

1. R2 → **Manage API tokens** → **Create API token**.
2. Escopo: **restrinja ao bucket criado** (não "todos os buckets") — permissão *Object Read &
   Write*.
3. Anote os quatro valores que a Cloudflare mostra **uma única vez**:
   - Account ID
   - Access Key ID
   - Secret Access Key
   - Endpoint (`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`)

## Passo 3 — guardar credenciais como secrets do Supabase

Mesmo padrão já usado pra `GM_TOKEN`/`SUPABASE_SERVICE_ROLE_KEY` — nunca no repo, só via CLI:

```bash
supabase secrets set \
  R2_ACCOUNT_ID=xxxxxxxxxxxxxxxx \
  R2_ACCESS_KEY_ID=xxxxxxxxxxxxxxxx \
  R2_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxx \
  R2_BUCKET_NAME=estatica-midia \
  R2_PUBLIC_BASE_URL=https://pub-xxxxxxxx.r2.dev
```

(`R2_PUBLIC_BASE_URL` é o domínio público do Passo 1 — `pub-xxxxxxxx.r2.dev` ou seu domínio
customizado — usado só pra montar a URL pública de volta, não pra autenticar nada.)

## Passo 4 — Edge Function `presign-r2-upload`

Segue exatamente o padrão das functions existentes (`supabase/functions/vincular-mestre`,
`supabase/functions/gerenciar-fila-forcada`): Deno + import via `esm.sh`, CORS fixo, cliente
anônimo só pra resolver `auth.getUser()`, cliente `service_role` pra qualquer coisa
privilegiada, checagem de GM pela tabela `mestres` (mesma query do `gerenciar-fila-forcada`).

Assinatura da URL via [`aws4fetch`](https://github.com/kotx/aws4fetch) — lib pequena própria
pra assinar requests estilo AWS/S3 em runtime edge/Deno (é o que a própria Cloudflare recomenda
nos exemplos deles de presigned URL pro R2).

Crie `supabase/functions/presign-r2-upload/index.ts`:

```ts
// Edge Function `presign-r2-upload` — gera uma URL de upload assinada (PUT) pro bucket R2,
// pra migrar áudio (sfx/) e, opcionalmente, mapas (img/mapa/) pra fora do Supabase Storage
// (ver .claude/docs/storage-r2.md). Só GM sobe hoje — se um dia migrar fotos de ficha
// também, replicar aqui a exceção de dono-de-ficha da migração 0031
// (storage_imagens_ficha_dono.sql): checar characters_privado.auth_uid = auth.uid() além
// do check de GM abaixo, pro prefixo img/fichas/.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// prefixos liberados hoje — adicione 'img/mapa/' quando migrar mapas também (Passo 5 opcional).
const PREFIXOS_PERMITIDOS = ['sfx/'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ erro: 'método não permitido' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ erro: 'sem autenticação' }, 401);

  let body: { path?: string; tipo?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ erro: 'corpo inválido' }, 400);
  }
  const { path, tipo } = body;
  if (!path || !tipo) return jsonResponse({ erro: 'path/tipo ausente' }, 400);
  if (!PREFIXOS_PERMITIDOS.some((p) => path.startsWith(p))) {
    return jsonResponse({ erro: 'prefixo não permitido' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

  const clienteChamador = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await clienteChamador.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ erro: 'sessão inválida' }, 401);

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: mestre } = await admin.from('mestres').select('auth_uid').eq('auth_uid', userData.user.id).maybeSingle();
  if (!mestre) return jsonResponse({ erro: 'só o mestre sobe mídia' }, 403);

  const accountId = Deno.env.get('R2_ACCOUNT_ID')!;
  const bucket = Deno.env.get('R2_BUCKET_NAME')!;
  const r2 = new AwsClient({
    accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
    secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
    service: 's3',
    region: 'auto',
  });

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${path}`;
  const assinada = await r2.sign(
    new Request(endpoint, { method: 'PUT', headers: { 'Content-Type': tipo } }),
    { aws: { signQuery: true } },
  );

  const publicBase = Deno.env.get('R2_PUBLIC_BASE_URL')!;
  return jsonResponse(
    { uploadUrl: assinada.url, publicUrl: `${publicBase}/${path}` },
    200,
  );
});
```

Deploy manual (não há step de CI pra Edge Functions neste projeto — `.github/workflows/`
só cuida do build/deploy do site estático):

```bash
supabase functions deploy presign-r2-upload
```

## Passo 5 — trocar o upload no cliente pra usar o R2

Novo helper, mesmo formato de `src/multiplayer/uploadImagemStorage.ts`:

```ts
// src/multiplayer/uploadR2.ts
import { supabase } from '../lib/supabaseClient';

export async function uploadR2(path: string, arquivo: Blob, tipo: string): Promise<string | null> {
  const cliente = supabase;
  if (!cliente) return null;

  const { data, error } = await cliente.functions.invoke<{ uploadUrl: string; publicUrl: string }>(
    'presign-r2-upload',
    { body: { path, tipo } },
  );
  if (error || !data) {
    console.error('[uploadR2] presign falhou', error);
    return null;
  }

  const resposta = await fetch(data.uploadUrl, { method: 'PUT', body: arquivo, headers: { 'Content-Type': tipo } });
  if (!resposta.ok) {
    console.error('[uploadR2] PUT falhou', resposta.status);
    return null;
  }
  return data.publicUrl;
}
```

Troca os call sites que hoje fazem `supabase.storage.from('midia').upload(...)`:

- **`src/features/midia/MidiaTab.tsx`** (`importarArquivo`) — obrigatório.
- **`src/features/midia/SoundpadGrid.tsx`** (`enviar`) — obrigatório.
- **`src/features/mapa/MapaTab.tsx`** (via `uploadImagemStorage.ts`) — só se decidir migrar
  mapas também (Passo 1: adicionar `'img/mapa/'` em `PREFIXOS_PERMITIDOS`).

Cada troca é: `uploadImagemStorage/storage.from('midia').upload` vira `uploadR2(path, blob,
tipo)`, path com o mesmo prefixo de antes (`sfx/{uuid}.mp3`, etc.) — o shape salvo no store/DB
(campo `url`) não muda, só o domínio da URL.

*(Este passo é só documentado aqui — a implementação nos arquivos acima fica pra depois que o
Passo 1-3 estiver feito manualmente na Cloudflare, é uma tarefa separada.)*

## Passo 6 — migrar arquivos já existentes (backfill)

Script local único (roda uma vez, fora do app — Node ou Deno na sua máquina), não faz parte do
bundle:

1. Lista os objetos do bucket Supabase `midia` sob `sfx/` (`storage.from('midia').list('sfx')`).
2. Pra cada um: baixa (`storage.from('midia').download(path)`), reenvia pro R2 (mesmo endpoint
   S3-compatible do Passo 4, mas local — pode usar `aws4fetch` ou qualquer client S3 com as
   credenciais do Passo 2 direto, sem precisar da Edge Function).
3. Atualiza a URL nas tabelas que referenciam esses arquivos: `soundpad_sons.url`,
   `midia_faixas.url` (e `mapas` se migrar mapas também) — trocando o domínio Supabase pelo
   `R2_PUBLIC_BASE_URL`.

**Faça backup do banco antes de rodar** (`supabase db dump` ou export pelo dashboard) — o passo
3 é um `UPDATE` em massa.

## Passo 7 — testar

- Upload de um arquivo novo pelo fluxo migrado → confirma que toca/aparece no app.
- Leitura pública funciona **sem autenticação** (abrir a URL do R2 direto, aba anônima).
- Upload como não-GM continua bloqueado (401/403 da Edge Function).
- CORS funciona a partir do domínio **real** do GitHub Pages publicado, não só localhost — teste
  no site publicado, não só no `npm run dev`.

## Passo 8 — limpeza

- Só depois de confirmar que nada mais lê as URLs antigas: apagar os objetos migrados do bucket
  Supabase `midia` (libera a cota de 1GB).
- `mesa-estatica-multiplayer-completo.md` descreve um plano antigo de buckets separados
  (`media-geral`/`media-gm`) que nunca foi implementado — nem antes nem depois desta migração
  isso reflete o código real (é sempre o bucket único `midia`, ou R2 pros prefixos migrados).
  Vale marcar essa seção do doc como desatualizada quando alguém for mexer nela.
