-- Infra pro item 2 do ROADMAP.md (replanejado 25/08): reset de produção sem depender de
-- is_gm(), e token de mestre que o mestre troca sozinho.
--
-- (a) `token_tentativas_global` generaliza `mestre_tentativas_global` (migração 0024) pra
--     qualquer segredo sensível chaveado por nome — `reset-mesa` e `trocar-token-mestre` não
--     têm auth_uid pra segmentar por identidade (não exigem ser mestre), só uma trava global
--     por function evita adivinhação por força bruta. Mesmo formato SQL de 0024, parametrizado
--     por `chave` em vez de linha única fixa.
--
-- (b) `mestre_config` guarda o hash do GM_TOKEN vigente. Enquanto a linha não existir, as
--     Edge Functions (`vincular-mestre`, `trocar-token-mestre`) caem no fallback de comparar
--     com o secret `GM_TOKEN` de hoje — isso é o que permite o bootstrap sem precisar seedar
--     um hash aqui (a migração não tem como saber o valor do secret).

create table if not exists public.token_tentativas_global (
  chave text primary key,
  tentativas integer not null default 0,
  janela_inicio timestamptz not null default now(),
  bloqueado_ate timestamptz
);

alter table public.token_tentativas_global enable row level security;
-- de propósito: nenhuma policy — só service_role (Edge Functions) lê/escreve.

create or replace function public.registrar_tentativa_token_global(
  p_chave text,
  p_limite integer,
  p_janela_minutos integer
)
returns public.token_tentativas_global
language plpgsql
security definer
set search_path = public
as $$
declare
  v_linha public.token_tentativas_global;
  v_janela_expirada boolean;
begin
  insert into public.token_tentativas_global (chave) values (p_chave)
    on conflict (chave) do nothing;

  select * into v_linha from public.token_tentativas_global where chave = p_chave for update;

  v_janela_expirada := v_linha.janela_inicio < now() - make_interval(mins => p_janela_minutos);

  if v_janela_expirada and (v_linha.bloqueado_ate is null or v_linha.bloqueado_ate < now()) then
    update public.token_tentativas_global
      set tentativas = 1, janela_inicio = now(), bloqueado_ate = null
      where chave = p_chave
      returning * into v_linha;
    return v_linha;
  end if;

  update public.token_tentativas_global
    set tentativas = tentativas + 1
    where chave = p_chave
    returning * into v_linha;

  if v_linha.tentativas >= p_limite then
    update public.token_tentativas_global
      set bloqueado_ate = now() + make_interval(mins => p_janela_minutos)
      where chave = p_chave
      returning * into v_linha;
  end if;

  return v_linha;
end;
$$;

revoke all on function public.registrar_tentativa_token_global(text, integer, integer) from public, anon, authenticated;

create or replace function public.zerar_tentativa_token_global(p_chave text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.token_tentativas_global where chave = p_chave;
$$;

revoke all on function public.zerar_tentativa_token_global(text) from public, anon, authenticated;

-- ===== mestre_config =====

create table if not exists public.mestre_config (
  id boolean primary key default true,
  token_hash text not null,
  atualizado_em timestamptz not null default now(),
  constraint mestre_config_singleton check (id)
);

alter table public.mestre_config enable row level security;
-- de propósito: nenhuma policy — só service_role (Edge Functions) lê/escreve, mesmo padrão de
-- `mestres` (0002_fase_b_fichas.sql). Sem seed: sem linha aqui, o bootstrap usa o GM_TOKEN atual.
