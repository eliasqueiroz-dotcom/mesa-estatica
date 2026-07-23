-- Fase B — fichas com dono real (mesa-estatica-multiplayer-completo.md §11, Parte IV §3)
--
-- Modelo: characters_publico (superfície de mesa, leitura de todos) e
-- characters_privado (resto da ficha, num blob jsonb — não precisamos de
-- coluna por campo pra isso; o cliente já valida o shape via TypeScript).
-- Ownership real via Supabase Anonymous Auth: characters_privado.auth_uid
-- é setado pela Edge Function `vincular-jogador`, nunca pelo cliente direto.
--
-- `mestres` resolve o "GM: todas" das policies sem precisar de token
-- trafegando em cada request — auth.uid() do mestre entra aqui via a
-- Edge Function `vincular-mestre`. Tabela sem nenhuma policy (RLS
-- habilitado, zero policy = nega geral pra anon/authenticated); só
-- é lida através da função is_gm() abaixo, que roda com privilégio
-- elevado (security definer) pra poder checar a tabela travada.

create table if not exists public.mestres (
  auth_uid uuid primary key
);

alter table public.mestres enable row level security;
-- de propósito: nenhuma policy aqui — só service_role (Edge Functions) mexe nessa tabela.

create or replace function public.is_gm()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.mestres where auth_uid = auth.uid());
$$;

-- Tabelas primeiro (sem policy ainda) — characters_publico referencia
-- characters_privado numa policy mais abaixo, então as duas precisam
-- existir antes de qualquer `create policy`.

create table if not exists public.characters_publico (
  id uuid primary key,
  nome text not null default '',
  cor_visual text not null default '',
  pv_atual integer not null default 0,
  pv_maximo integer not null default 0,
  surtos_ativos jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.characters_privado (
  id uuid primary key,
  owner_token uuid not null unique,
  auth_uid uuid,
  dados jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists characters_privado_owner_token_idx on public.characters_privado (owner_token);

alter table public.characters_publico enable row level security;
alter table public.characters_privado enable row level security;

create policy "characters_publico_select_all" on public.characters_publico
  for select using (true);

create policy "characters_publico_insert_gm" on public.characters_publico
  for insert with check (public.is_gm());

create policy "characters_publico_update_dono_ou_gm" on public.characters_publico
  for update using (
    public.is_gm()
    or id in (select id from public.characters_privado where auth_uid = auth.uid())
  );

create policy "characters_publico_delete_gm" on public.characters_publico
  for delete using (public.is_gm());

create policy "characters_privado_select_dono_ou_gm" on public.characters_privado
  for select using (public.is_gm() or auth_uid = auth.uid());

-- só a Edge Function vincular-jogador (service_role) cria linha nova ou seta auth_uid;
-- o cliente comum nunca faz insert aqui.
create policy "characters_privado_insert_gm" on public.characters_privado
  for insert with check (public.is_gm());

create policy "characters_privado_update_dono_ou_gm" on public.characters_privado
  for update using (public.is_gm() or auth_uid = auth.uid());

create policy "characters_privado_delete_gm" on public.characters_privado
  for delete using (public.is_gm());

-- Realtime: seguro ligar em privado também porque agora a RLS é por dono de
-- verdade (diferente da Fase A, onde tudo era aberto) — o broadcast só
-- alcança quem já teria permissão de SELECT na linha.
alter publication supabase_realtime add table public.characters_publico;
alter publication supabase_realtime add table public.characters_privado;
