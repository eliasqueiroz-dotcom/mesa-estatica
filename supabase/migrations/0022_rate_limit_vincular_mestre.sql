-- Rate limit da Edge Function `vincular-mestre` — hoje ela compara o `gm_token` recebido
-- contra o secret via string simples, sem limite de tentativas nenhum. Com o site publicado
-- (URL não mais só "achável por quem já tem o link localhost"), alguém que descobrisse a URL
-- podia tentar adivinhar o token indefinidamente sem custo.
--
-- Chave de rate limit é `auth_uid` (identidade da sessão anônima já validada pelo JWT), não
-- IP — não dá pra confiar em header de IP client-supplied sem saber o proxy exato na frente
-- da function, e o `auth_uid` já vem verificado pelo `getUser()` que a function já fazia.
-- Só a própria Edge Function (service_role) mexe aqui — RLS habilitado, zero policy.

create table if not exists public.mestre_tentativas (
  auth_uid uuid primary key,
  tentativas integer not null default 0,
  ultima_tentativa timestamptz not null default now(),
  bloqueado_ate timestamptz
);

alter table public.mestre_tentativas enable row level security;
-- de propósito: nenhuma policy — só a function via service_role escreve/lê aqui.
