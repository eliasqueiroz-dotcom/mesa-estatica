-- Corrige dois problemas do rate limit de `vincular-mestre` (migração 0022):
--
-- (a) Não atômico: a Edge Function fazia "select tentativas → soma em JS → upsert" em dois
--     passos separados. Tentativas disparadas em paralelo pra mesma identidade liam o mesmo
--     valor antigo antes de qualquer uma escrever de volta — o contador nunca avançava mais
--     que +1 por rajada, não importa quantas tentativas corressem juntas. Fix: o incremento
--     agora é feito inteiro dentro de uma função Postgres (INSERT ... ON CONFLICT DO UPDATE
--     dentro de registrar_tentativa_mestre), que o Postgres serializa via lock de linha —
--     duas chamadas concorrentes pra mesma auth_uid nunca leem o mesmo "antes".
--
-- (b) Só por identidade: o limite de 5 tentativas é por `auth_uid`, e uma sessão anônima nova
--     (aba anônima, limpar dados do site) é de graça — reseta a contagem indefinidamente sem
--     custo. Fix: uma trava GLOBAL adicional (linha única, independente de auth_uid) conta
--     tentativas falhas de QUALQUER identidade na mesma janela; passar de um limiar bem maior
--     (20) bloqueia novas tentativas de todo mundo até a janela expirar. Continuamos sem usar
--     IP como chave (mesmo motivo da 0022: não dá pra confiar em header de IP sem saber o
--     proxy exato na frente da function) — o eixo de defesa aqui é "quantas tentativas
--     seguidas, não de quem", que rotacionar auth_uid não escapa.

-- ===== (a) incremento atômico por identidade =====

create or replace function public.registrar_tentativa_mestre(
  p_auth_uid uuid,
  p_limite integer,
  p_janela_minutos integer
)
returns public.mestre_tentativas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_linha public.mestre_tentativas;
begin
  insert into public.mestre_tentativas as mt (auth_uid, tentativas, ultima_tentativa, bloqueado_ate)
  values (p_auth_uid, 1, now(), null)
  on conflict (auth_uid) do update
    set tentativas = mt.tentativas + 1,
        ultima_tentativa = now()
  returning * into v_linha;

  if v_linha.tentativas >= p_limite then
    update public.mestre_tentativas
      set tentativas = 0,
          bloqueado_ate = now() + make_interval(mins => p_janela_minutos)
      where auth_uid = p_auth_uid
      returning * into v_linha;
  end if;

  return v_linha;
end;
$$;

revoke all on function public.registrar_tentativa_mestre(uuid, integer, integer) from public, anon, authenticated;

-- ===== (b) trava global independente de identidade =====

create table if not exists public.mestre_tentativas_global (
  id boolean primary key default true,
  tentativas integer not null default 0,
  janela_inicio timestamptz not null default now(),
  bloqueado_ate timestamptz,
  constraint mestre_tentativas_global_singleton check (id)
);

insert into public.mestre_tentativas_global (id) values (true) on conflict (id) do nothing;

alter table public.mestre_tentativas_global enable row level security;
-- de propósito: nenhuma policy — só a function via service_role escreve/lê aqui.

create or replace function public.registrar_tentativa_mestre_global(
  p_limite integer,
  p_janela_minutos integer
)
returns public.mestre_tentativas_global
language plpgsql
security definer
set search_path = public
as $$
declare
  v_linha public.mestre_tentativas_global;
  v_janela_expirada boolean;
begin
  select * into v_linha from public.mestre_tentativas_global where id = true for update;

  v_janela_expirada := v_linha.janela_inicio < now() - make_interval(mins => p_janela_minutos);

  if v_janela_expirada and (v_linha.bloqueado_ate is null or v_linha.bloqueado_ate < now()) then
    update public.mestre_tentativas_global
      set tentativas = 1, janela_inicio = now(), bloqueado_ate = null
      where id = true
      returning * into v_linha;
    return v_linha;
  end if;

  update public.mestre_tentativas_global
    set tentativas = tentativas + 1
    where id = true
    returning * into v_linha;

  if v_linha.tentativas >= p_limite then
    update public.mestre_tentativas_global
      set bloqueado_ate = now() + make_interval(mins => p_janela_minutos)
      where id = true
      returning * into v_linha;
  end if;

  return v_linha;
end;
$$;

revoke all on function public.registrar_tentativa_mestre_global(integer, integer) from public, anon, authenticated;
