-- Fase C — rolagens honestas + forçadas via Edge Function (mesa-estatica-multiplayer-completo.md §11, §5)
--
-- forced_queue: ninguém no cliente lê/escreve — RLS habilitado, ZERO policy (nega geral pra
-- anon/authenticated, de propósito). Só a Edge Function resolver-rolagem (service_role) mexe aqui.
--
-- rolls_log: todos leem (é o log público da mesa); insert só via Edge Function (sem policy de
-- insert pra anon/authenticated); "limpar log" é delete, só GM.

create table if not exists public.forced_queue (
  id uuid primary key default gen_random_uuid(),
  character_id uuid,
  valores integer[] not null,
  consumido boolean not null default false,
  criado_por uuid,
  criado_em timestamptz not null default now()
);

alter table public.forced_queue enable row level security;
-- de propósito: nenhuma policy aqui — ver aviso acima.

create table if not exists public.rolls_log (
  id uuid primary key default gen_random_uuid(),
  character_id uuid,
  formula text not null,
  valores integer[] not null,
  total integer not null,
  tipo text,
  criado_em timestamptz not null default now()
);

alter table public.rolls_log enable row level security;

create policy "rolls_log_select_all" on public.rolls_log
  for select using (true);

create policy "rolls_log_delete_gm" on public.rolls_log
  for delete using (public.is_gm());

alter publication supabase_realtime add table public.rolls_log;
