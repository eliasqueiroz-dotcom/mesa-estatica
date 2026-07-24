-- sessao_publica (mesa-estatica-multiplayer-completo.md §4, Parte III/IV)
--
-- Linha única (singleton) — esta implementação não tem conceito de session_id
-- (uma mesa por projeto Supabase, ver auth.ts/links.ts que já assumem isso); o client
-- sempre lê/escreve id = 'sessao'. sessao_privada (gauges, lembretes, "o que realmente
-- acontece") fica de fora desta migração — nunca sobe pro Supabase, só GM/local.

create table if not exists public.sessao_publica (
  id text primary key default 'sessao',
  nome_da_mesa text not null default '',
  numero_sessao integer not null default 1,
  clima text not null default '',
  hora text not null default '',
  cena_atual text not null default '',
  caso text not null default '',
  local_atual text not null default '',
  objetivo text not null default '',
  progresso jsonb not null default '{"atual":0,"total":0}'::jsonb,
  atmosfera text not null default '',
  contador_cena integer not null default 1,
  modo_combate boolean not null default false,
  indice_atual_turno integer not null default 0,
  rodada integer not null default 1,
  condicoes_combate jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint sessao_publica_singleton check (id = 'sessao')
);

alter table public.sessao_publica enable row level security;

create policy "sessao_publica_select_all" on public.sessao_publica
  for select using (true);

create policy "sessao_publica_insert_gm" on public.sessao_publica
  for insert with check (public.is_gm());

create policy "sessao_publica_update_gm" on public.sessao_publica
  for update using (public.is_gm());

alter publication supabase_realtime add table public.sessao_publica;
