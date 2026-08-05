-- Soundpad — 6 botões de efeito sonoro disparados pelo GM, ouvidos por todos.
--
-- Mesmos dois padrões da mídia (0008): `soundpad_sons` é lista (sync por diff),
-- `soundpad_estado` é singleton. Reusa o bucket `midia` já existente, com prefixo `sfx/`
-- nos paths — evita um segundo bucket e a duplicação das 4 policies de storage.
--
-- Por que tabela própria em vez de colunas em `midia_estado`: `atualizarEstadoMidia`
-- (store.ts) SEMPRE recarimba `atualizado_em`, e `calcularPosicaoEsperada`
-- (multiplayer/posicaoMidia.ts) usa esse campo como base pra projetar a posição da música.
-- Disparar um efeito por ali mexeria no relógio da música e causaria salto audível em todo
-- mundo. Canal separado mantém as duas coisas independentes.

create table if not exists public.soundpad_sons (
  id uuid primary key default gen_random_uuid(),
  slot integer not null unique,
  nome text not null default '',
  storage_path text not null,
  url text not null,
  criado_em timestamptz not null default now(),
  constraint soundpad_sons_slot_valido check (slot >= 0 and slot <= 5)
);

alter table public.soundpad_sons enable row level security;

create policy "soundpad_sons_select_all" on public.soundpad_sons
  for select using (true);

create policy "soundpad_sons_insert_gm" on public.soundpad_sons
  for insert with check (public.is_gm());

create policy "soundpad_sons_update_gm" on public.soundpad_sons
  for update using (public.is_gm());

create policy "soundpad_sons_delete_gm" on public.soundpad_sons
  for delete using (public.is_gm());

-- `disparo_slot`/`disparo_em` são um EVENTO, não estado contínuo: o GM carimba, cada
-- cliente compara `disparo_em` com o último que já tocou e dispara só se for mais novo.
-- Sem isso, um refetch qualquer (reconexão do Realtime) repetiria o efeito.
create table if not exists public.soundpad_estado (
  id text primary key default 'soundpad',
  volume double precision not null default 0.8,
  disparo_slot integer,
  disparo_em timestamptz,
  constraint soundpad_estado_singleton check (id = 'soundpad'),
  constraint soundpad_estado_volume_valido check (volume >= 0 and volume <= 1)
);

alter table public.soundpad_estado enable row level security;

create policy "soundpad_estado_select_all" on public.soundpad_estado
  for select using (true);

create policy "soundpad_estado_insert_gm" on public.soundpad_estado
  for insert with check (public.is_gm());

create policy "soundpad_estado_update_gm" on public.soundpad_estado
  for update using (public.is_gm());

alter publication supabase_realtime add table public.soundpad_sons;
alter publication supabase_realtime add table public.soundpad_estado;
