-- Fase A — sincronização de posição de tokens (mesa-estatica-multiplayer-completo.md §11)
--
-- ATENÇÃO — postura de segurança desta fase: RLS aberto pra leitura/escrita com a
-- chave anon. Ainda não há Anonymous Auth nem separação de dono (isso é Fase B/F do
-- doc). Aceitável só porque o link do projeto Supabase não é divulgado publicamente
-- e o grupo é fechado (Discord privado da mesa) — não é o modelo de segurança final.

create table if not exists public.tokens (
  id uuid primary key,
  participante_id uuid not null,
  tipo text not null check (tipo in ('pc', 'npc')),
  x double precision not null check (x >= 0 and x <= 1),
  y double precision not null check (y >= 0 and y <= 1),
  updated_at timestamptz not null default now()
);

alter table public.tokens enable row level security;

create policy "tokens_select_all" on public.tokens
  for select using (true);

create policy "tokens_insert_all" on public.tokens
  for insert with check (true);

create policy "tokens_update_all" on public.tokens
  for update using (true);

create policy "tokens_delete_all" on public.tokens
  for delete using (true);

-- liga o Realtime (replication) nesta tabela
alter publication supabase_realtime add table public.tokens;
