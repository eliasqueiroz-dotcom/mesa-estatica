-- mapa_publico (mesa-estatica-multiplayer-completo.md Parte IV §5 — aba Mapa do jogador)
--
-- Linha única (singleton), mesmo padrão de 0004_sessao_publica.sql — id fixo 'mapa', sem
-- session_id (uma mesa por projeto Supabase). Só o fundo (imagem) + grade; `tokens` já tem
-- tabela própria (0001_fase_a_tokens.sql) e sync próprio (tokensSync.ts), não entra aqui.

create table if not exists public.mapa_publico (
  id text primary key default 'mapa',
  imagem_data_url text,
  grade jsonb not null default '{"ativa":false,"x":0,"y":0,"largura":100,"altura":100,"colunas":10,"linhas":10}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint mapa_publico_singleton check (id = 'mapa')
);

alter table public.mapa_publico enable row level security;

create policy "mapa_publico_select_all" on public.mapa_publico
  for select using (true);

create policy "mapa_publico_insert_gm" on public.mapa_publico
  for insert with check (public.is_gm());

create policy "mapa_publico_update_gm" on public.mapa_publico
  for update using (public.is_gm());

alter publication supabase_realtime add table public.mapa_publico;
