-- foW_estado — singleton de Fog of War (ROADMAP F1).
--
-- Mesmo padrão de `mapa_publico` (0007): linha única por projeto Supabase (uma mesa por
-- projeto, id fixo 'fow'), sem `session_id`. Guarda `vistas` (já visitado — persiste entre
-- sessões) e `visiveis_agora` (luz atual, subset de `vistas`), mais `proximo_id_zona` que
-- controla o matiz do chiado na próxima região traçada ('rua' âmbar / 'corporativo' ciano /
-- null P&B puro).
--
-- `vistas` e `visiveis_agora` são jsonb contendo arrays de `RegiaoFoW` (id, forma='rect',
-- x/y/w/h em 0-1 da imagem, zona). Em v2 (polígonos) `forma='poly'` + `pontos[]` entra sem
-- migration de schema — jsonb acomoda o campo extra. `version` é um monotonic counter pra
-- diff/merge em `fowSync.ts` (mesmo auxiliar de `midia_estado.atualizado_em`).
--
-- RLS espelha `mapa_publico`: select liberado a `authenticated` (jogador precisa LER a
-- máscara pra renderizar a camada "visto" no app dele); insert/update/delete só `is_gm()`.
-- Sem channel Realtime custom — basta a publicação default em `supabase_realtime` (override
-- do pattern de `mapa_publico` que adiciona manualmente: aqui herda da mesma publicação já
-- ativa desde `0007_mapa_publico.sql`).

create table if not exists public.fow_estado (
  id text primary key default 'fow',
  vistas jsonb not null default '[]'::jsonb,
  visiveis_agora jsonb not null default '[]'::jsonb,
  proximo_id_zona text,
  version int not null default 0,
  updated_at timestamptz not null default now(),
  constraint fow_estado_singleton check (id = 'fow')
);

alter table public.fow_estado enable row level security;

create policy "fow_estado_select_authenticated" on public.fow_estado
  for select to authenticated using (true);

create policy "fow_estado_insert_gm" on public.fow_estado
  for insert with check (public.is_gm());

create policy "fow_estado_update_gm" on public.fow_estado
  for update using (public.is_gm());

create policy "fow_estado_delete_gm" on public.fow_estado
  for delete using (public.is_gm());

alter publication supabase_realtime add table public.fow_estado;