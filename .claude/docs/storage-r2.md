# Mídia: Cloudflare R2 + Freesound

> Guia operacional — não é fonte de regra nem de arquitetura fechada (`arquitetura.md`
> continua sendo isso). Cobre três melhorias de infra na Cloudflare: reduzir Storage/egress
> do Supabase (R2), facilitar achar/adicionar efeito sonoro no soundpad (Freesound), e migrar a
> hospedagem estática do site de GitHub Pages pra Cloudflare Pages. Grep pela seção, como os
> outros docs — não precisa ler o arquivo inteiro pra fazer só uma parte.
>
> A Parte 3 (site) é **independente** das Partes 1/2 — não depende de R2 nem Freesound, pode ser
> feita a qualquer momento, antes, depois ou em paralelo. A única dependência cruzada: se a
> Parte 1 (R2) já tiver sido feita antes da Parte 3, o CORS do bucket R2 precisa ganhar o domínio
> novo do site (Parte 3, Passo 4).
>
> **Migração de Supabase (Postgres/RLS/Realtime/Auth/Edge Functions) pra Cloudflare está fora de
> escopo deste guia** — avaliado e descartado: significaria reescrever a camada de multiplayer
> inteira (RLS não tem equivalente direto no D1/SQLite) por um ganho pequeno. Só a mídia (R2) e o
> site (Pages) migram; o backend continua no Supabase.

## Ordem recomendada: R2 primeiro, Freesound depois

As duas partes deste guia são independentes uma da outra tecnicamente, mas a **ordem importa**:

Buscar som no Freesound é bem mais rápido que caçar e subir um arquivo manualmente — um clique
em "usar" em vez de sair do app, achar um arquivo, baixar, voltar e selecionar. Isso tende a
**aumentar** o ritmo de upload pro bucket `midia`, não reduzir. Lançar essa facilidade *antes* de
resolver o teto de 1GB do Supabase (Parte 1) só acelera bater na cota que já está apertada hoje.

Fazendo R2 primeiro, o passo "usar" da integração Freesound (Parte 2, Passo 3) já sobe o arquivo
baixado pro destino novo direto — sem precisar reescrever essa function depois que o R2 estiver
no ar. Se decidir implementar Freesound antes mesmo assim, é só trocar o destino do upload do
Passo 3 quando migrar (a function já isola isso numa função auxiliar única).

---

## Padrão comum a toda Edge Function deste guia

As duas functions novas abaixo (`presign-r2-upload`, `buscar-freesound`) seguem **exatamente** o
mesmo preâmbulo das que já existem no projeto (`supabase/functions/vincular-mestre`,
`supabase/functions/gerenciar-fila-forcada`) — mostrado aqui uma vez só, pra não repetir nos dois
blocos de código abaixo (cada um mostra só a lógica que muda de verdade). Ao criar o arquivo real,
esse trecho entra no topo, antes da lógica específica:

```ts
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const clienteChamador = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await clienteChamador.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ erro: 'sessão inválida' }, 401);

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: mestre } = await admin.from('mestres').select('auth_uid').eq('auth_uid', userData.user.id).maybeSingle();
  if (!mestre) return jsonResponse({ erro: '(mensagem específica de cada function)' }, 403);

  // ↓ a partir daqui é a lógica específica de cada function, ver Passo 4/Parte 2 Passo 3
});
```

# Parte 1 — Cloudflare R2 (Storage/egress)

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

Preâmbulo = o bloco "padrão comum" acima (mensagem do check de GM: `'só o mestre sobe mídia'`).
Import extra: [`aws4fetch`](https://github.com/kotx/aws4fetch) — lib pequena pra assinar
requests estilo AWS/S3 em runtime edge/Deno (é o que a própria Cloudflare recomenda nos exemplos
deles de presigned URL pro R2).

Crie `supabase/functions/presign-r2-upload/index.ts`. Lógica específica, depois do check de GM:

```ts
// import extra no topo do arquivo: import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

// prefixos liberados hoje — adicione 'img/mapa/' quando migrar mapas também (Passo 5 opcional).
// se um dia migrar fotos de ficha também, replicar aqui a exceção de dono-de-ficha da migração
// 0031 (storage_imagens_ficha_dono.sql): checar characters_privado.auth_uid = auth.uid() além
// do check de GM, pro prefixo img/fichas/.
const PREFIXOS_PERMITIDOS = ['sfx/'];

// logo depois do check de "sem autenticação" do preâmbulo, antes do getUser()/check de GM:
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

// ... resto do preâmbulo padrão (getUser + check de GM) ...

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
return jsonResponse({ uploadUrl: assinada.url, publicUrl: `${publicBase}/${path}` }, 200);
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

---

# Parte 2 — Freesound no soundpad

## Por quê

O soundpad (`src/features/midia/SoundpadGrid.tsx`, grade de 6 slots) só aceita upload manual de
arquivo local hoje (até 50MB, sem compressão, mesmo bucket `midia` da Parte 1, prefixo `sfx/`).
O [Freesound.org](https://freesound.org) tem uma biblioteca enorme de efeitos sonoros e
gravações de campo sob licença Creative Commons, de graça — dá pra buscar "estática", "passos
concreto", "rádio distorcido" direto no app em vez de caçar e baixar arquivo em outro lugar.

**Escopo: só o soundpad, não o jukebox.** Freesound é uma biblioteca de efeitos sonoros/gravação
de campo, não de música licenciada — não encaixa bem no `MidiaTab.tsx` (jukebox de trilha
sonora/ambiência longa).

A API do Freesound (confirmado na doc oficial, `freesound.org/docs/api/`):
- **Busca de texto é só um `token` na query string** (`GET /apiv2/search/text/?query=...&token=CHAVE`)
  — não precisa OAuth2. OAuth2 só é exigido pra ações de escrita (upload, avaliar) e pra baixar
  o arquivo **original** sem compressão, que não é o nosso caso.
- Cada resultado traz `id`, `name`, `username`, `license`, `duration`, e um objeto `previews`
  com `preview-hq-mp3` — a URL que interessa: toca direto num `<audio>` **e** é o que baixamos
  pra guardar no nosso bucket (o original de qualidade máxima exigiria OAuth2 e não faz falta
  pra um efeito sonoro tocado numa sessão de RPG).
- Filtro `filter=license:"Creative Commons 0"` restringe a resultados de domínio público (CC0).
  **Decisão de escopo pra v1**: só CC0, sem exigir atribuição nem guardar metadado de
  autor/licença — a tabela `soundpad_sons` não tem coluna pra isso hoje e não vale abrir
  migração só por isso. Dá pra abrir pra CC-BY (com atribuição) depois se fizer falta.

## Passo 1 — criar credencial no Freesound

1. Crie uma conta em [freesound.org](https://freesound.org) (grátis).
2. Peça uma credencial de API em `freesound.org/apiv2/apply/`.
3. Anote a chave (aparece na coluna "Client secret/Api key") — é o `token` usado na query string,
   não precisa de fluxo OAuth2 pra busca/prévia.

## Passo 2 — guardar como secret do Supabase

Mesmo padrão da Parte 1 (e do `GM_TOKEN`) — nunca no repo:

```bash
supabase secrets set FREESOUND_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Passo 3 — Edge Function `buscar-freesound`

Mesmo padrão Deno/`esm.sh`/CORS/checagem de GM da Parte 1 (`presign-r2-upload`) e das functions
já existentes. Duas ações no corpo, mesmo estilo do `acao` do `gerenciar-fila-forcada`:

- `buscar`: recebe `{ query }`, chama a busca do Freesound com a `FREESOUND_API_KEY`, devolve só
  `{ id, nome, duracao, previewUrl }` por resultado.
- `usar`: recebe `{ slot, previewUrl, nome }`, **baixa a prévia no servidor** (não no navegador —
  não dá pra garantir que o CDN de prévia do Freesound libera CORS pra `fetch()` de blob a
  partir do navegador; só `<audio src>` dispensa CORS, baixar bytes pra reenviar não) e sobe pro
  destino de mídia atual — bucket Supabase `midia`/`sfx/` hoje, ou pro R2 direto (via a mesma
  lógica de assinatura da Parte 1) se a Parte 1 já tiver sido feita. Devolve `{ path, url }`.

Preâmbulo = o bloco "padrão comum" (mensagem do check de GM: `'só o mestre busca/usa som'`; corpo
é `{ acao: 'buscar' | 'usar', query?, slot?, previewUrl?, nome? }` em vez de `{ path, tipo }`, com
`acao` no lugar de `path`/`tipo` na validação de "campo ausente").

Crie `supabase/functions/buscar-freesound/index.ts`. Lógica específica, depois do check de GM:

```ts
interface ResultadoFreesound {
  id: number;
  name: string;
  duration: number;
  previews: { 'preview-hq-mp3': string };
}

const freesoundKey = Deno.env.get('FREESOUND_API_KEY')!;

if (acao === 'buscar') {
  if (!body.query) return jsonResponse({ erro: 'query ausente' }, 400);
  const url = new URL('https://freesound.org/apiv2/search/text/');
  url.searchParams.set('query', body.query);
  url.searchParams.set('token', freesoundKey);
  url.searchParams.set('filter', 'license:"Creative Commons 0"');
  url.searchParams.set('fields', 'id,name,duration,previews');
  url.searchParams.set('page_size', '20');

  const resposta = await fetch(url);
  if (!resposta.ok) return jsonResponse({ erro: 'busca no freesound falhou' }, 502);
  const dados = await resposta.json();
  const resultados = (dados.results as ResultadoFreesound[]).map((r) => ({
    id: r.id,
    nome: r.name,
    duracao: r.duration,
    previewUrl: r.previews['preview-hq-mp3'],
  }));
  return jsonResponse({ resultados }, 200);
}

if (acao === 'usar') {
  const { slot, previewUrl, nome } = body;
  if (slot === undefined || !previewUrl || !nome) return jsonResponse({ erro: 'slot/previewUrl/nome ausente' }, 400);

  // download no servidor (motivo: ver bullet "usar" acima)
  const audio = await fetch(previewUrl);
  if (!audio.ok) return jsonResponse({ erro: 'download da prévia falhou' }, 502);
  const blob = await audio.blob();

  const path = `sfx/${crypto.randomUUID()}-freesound.mp3`;
  const { error: erroUpload } = await admin.storage.from('midia').upload(path, blob, { contentType: 'audio/mpeg' });
  if (erroUpload) return jsonResponse({ erro: 'upload falhou' }, 500);

  const { data: publicUrlData } = admin.storage.from('midia').getPublicUrl(path);
  return jsonResponse({ path, url: publicUrlData.publicUrl }, 200);
}

return jsonResponse({ erro: 'acao inválida' }, 400);
```

> Se a Parte 1 (R2) já tiver saído do papel, troque o bloco de upload da ação `usar` pela mesma
> lógica de assinatura/PUT da `presign-r2-upload` em vez de `admin.storage.from('midia').upload`
> — o resto da function (busca, checagem de GM) não muda.

Deploy manual, mesmo mecanismo:

```bash
supabase functions deploy buscar-freesound
```

## Passo 4 — onde entra no cliente (só descrito aqui, não implementado)

`SoundpadGrid.tsx` ganha uma segunda opção em cada slot além de "+ som" (upload manual): abrir
um painel de busca. Reaproveita:

- O **padrão de modal inline** já usado em `src/features/sessao/ResetSessao.tsx` (backdrop fixed
  + card `.secao`, fecha com Escape ou clique fora) — não existe componente de modal
  compartilhado no projeto, então replica o mesmo padrão copy-paste em vez de inventar
  abstração nova.
- O estado `enviandoSlot`/`erro` que o componente já tem, pro spinner e mensagem de erro do
  "usar".
- A action **já existente** `definirSomSoundpad(slot, nome, path, url)` (`src/state/store.ts`)
  — mesma que o upload manual chama depois de subir o arquivo. Nenhuma action nova no store,
  nenhuma migração de banco.

Fluxo: campo de busca → `functions.invoke('buscar-freesound', { body: { acao: 'buscar', query } })`
→ lista de resultados com botão de tocar prévia (`<audio src={previewUrl}>`) → botão "usar" →
`functions.invoke('buscar-freesound', { body: { acao: 'usar', slot, previewUrl, nome } })` →
resposta `{ path, url }` → `definirSomSoundpad(slot, nome, path, url)` → fecha o painel.

## Passo 5 — testar

- Busca por um termo retorna resultados só CC0, prévia toca no navegador.
- "Usar" preenche o slot e o som toca depois igual a um upload manual.
- Upload manual continua funcionando em paralelo, sem regressão.
- Busca/uso como sessão não-GM dá 403, igual as outras Edge Functions.
- Sem `FREESOUND_API_KEY` configurada ou function não deployada: o botão de busca falha com
  mensagem de erro isolada — nunca quebra o fluxo de upload manual existente.

---

# Parte 3 — Site: GitHub Pages → Cloudflare Pages

## Por quê

Hoje o site é buildado e publicado no GitHub Pages via
[`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) — de graça, funciona bem
pra um SPA estático. Migrar pro Cloudflare Pages **não é uma melhoria dramática**: o ganho é CDN
da Cloudflare, possibilidade de domínio próprio (hoje é `queiroz-labs.github.io/mesa-estatica/`,
um subpath de projeto), e consolidar site + mídia no mesmo dashboard se a Parte 1 (R2) também
tiver sido feita. Só vale a pena se quiser sair do subpath ou já estiver na Cloudflare por causa
do R2 — não é urgente.

## Passo 1 — criar o projeto no Cloudflare Pages (sem trocar o CI)

Dashboard da Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Direct Upload**. O
nome digitado vira o subdomínio (`<nome>.pages.dev`) **e** o identificador que o
`wrangler pages deploy --project-name=...` usa — se o nome já estiver em uso por outra conta
(o `*.pages.dev` é compartilhado globalmente), a Cloudflare acrescenta um sufixo automático. Foi
o que aconteceu aqui: o nome digitado foi `estatica`, mas o projeto final ficou `estatica-stc`
(`estatica-stc.pages.dev`) — confira o nome real em **Settings → General** do projeto antes de
preencher o `--project-name` do Passo 1 abaixo, não assuma que é o que você digitou.

**Não conecte o repositório GitHub direto no Cloudflare Pages** (a opção "Connect to Git" da
tela de criação) — a integração Git nativa do Pages builda no push e **não roda `npm run
lint`/`npm test`** como gate, só o comando de build. Isso perderia o comportamento que o
`CLAUDE.md` documenta hoje ("push em main → build + test → deploy") e que o `deploy.yml` atual
garante. Em vez disso, o deploy continua saindo do GitHub Actions existente.

O `deploy.yml` original tinha `build` e `deploy` como jobs **separados** (o `dist/` só existia no
job `build`; o job `deploy` baixava o artefato via o mecanismo próprio do
`actions/deploy-pages`). O `wrangler-action` precisa do `dist/` no mesmo job onde roda, então a
troca funde tudo num job só e remove as `permissions`/`environment` que eram exclusivas do
GitHub Pages (`pages: write`, `id-token: write`, `environment: github-pages`):

```yaml
name: Deploy Cloudflare Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - run: npm test
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=estatica-stc
```

`npm ci` → `npm run lint` → `npm run build` → `npm test` continuam exatamente como estão hoje —
o gate não muda, só o destino do deploy e a estrutura de jobs (um só, em vez de dois).

## Passo 2 — secrets do GitHub Actions

Mesmo padrão "nunca no repo" já usado pros outros secrets do projeto (`VITE_SUPABASE_URL` etc.),
em **Settings → Secrets and variables → Actions** do repo:

- `CLOUDFLARE_API_TOKEN` — criar em Cloudflare → **Manage API tokens**, escopo *Cloudflare
  Pages:Edit* (restrinja à conta, não precisa de acesso amplo).
- `CLOUDFLARE_ACCOUNT_ID` — visível no dashboard da Cloudflare (barra lateral de qualquer
  domínio/projeto).

## Passo 3 — ajustar o `base` do Vite

[`vite.config.ts`](../../vite.config.ts) hoje tem `base: '/mesa-estatica/'` — necessário porque
GitHub Pages de projeto serve sob `/<nome-do-repo>/`. Cloudflare Pages serve na raiz do domínio
próprio (`estatica-stc.pages.dev` ou domínio customizado), então troca pra `base: '/'`. Os dois
entrypoints do build (`mestre: index.html`, `jogador: jogador.html`) não são afetados por essa
mudança — só o prefixo dos assets.

## Passo 4 — atualizar CORS do bucket R2 (só se a Parte 1 já tiver sido feita)

O CORS do bucket R2 (Parte 1, Passo 1) lista `https://queiroz-labs.github.io` em
`AllowedOrigins`. Trocar pelo domínio novo do Cloudflare Pages (ou manter os dois, se o GitHub
Pages antigo continuar no ar durante a transição — ver Passo 6).

## Passo 5 — atualizar referências ao domínio antigo

`mesa-estatica-multiplayer-completo.md` tem um link de exemplo do jogador usando
`https://queiroz-labs.github.io/mesa-estatica/?s=<session_id>&t=<owner_token>` — marcar como
desatualizado quando o domínio mudar, mesmo padrão que a Parte 1 já usa pra outras seções
obsoletas desse doc (ver Passo 8 da Parte 1).

## Passo 6 — testar

- Build local (`npm run build && npm run preview`) confirma que rotas e assets funcionam com
  `base: '/'` antes de mexer no workflow.
- Rodar o deploy via `workflow_dispatch` (não esperar um push em `main`) pra validar o pipeline
  novo isoladamente.
- Testar as duas entradas (`index.html` mestre e `jogador.html`) no domínio novo, inclusive
  upload de mídia se a Parte 1 já estiver migrada (CORS do Passo 4).
- Manter o GitHub Pages antigo no ar até confirmar que o domínio novo funciona ponta a ponta —
  só então atualizar links compartilhados com jogadores e, se quiser, desligar o `deploy-pages`
  antigo de vez.
