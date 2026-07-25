-- Mídia — jukebox sincronizado (mesa-estatica-multiplayer-completo.md descreve uma aba
-- Mídia mais ampla — galeria de fotos/provas, pastas GM/Geral, botão "revelar", Parte I §9 /
-- Parte II §6 — isto NÃO é isso. Escopo confirmado com o usuário: só faixas de áudio +
-- transporte compartilhado (GM toca, todo mundo ouve). A galeria de imagens fica de fora,
-- item separado pro ROADMAP depois.
--
-- Dois padrões já usados no projeto:
--   midia_faixas — lista (padrão de `tokens`/`npcs_publico`: sem dono, sync por diff).
--   midia_estado — singleton de playback (padrão de `mapa_publico`/`sessao_publica`: id fixo).
--
-- Bucket público (decisão confirmada) — mesma postura de segurança já aceita em `tokens`
-- (RLS aberta): grupo fechado no Discord é a fronteira real, não URL assinada/expiração.

create table if not exists public.midia_faixas (
  id uuid primary key default gen_random_uuid(),
  nome text not null default '',
  storage_path text not null,
  url text not null,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);

alter table public.midia_faixas enable row level security;

create policy "midia_faixas_select_all" on public.midia_faixas
  for select using (true);

create policy "midia_faixas_insert_gm" on public.midia_faixas
  for insert with check (public.is_gm());

create policy "midia_faixas_update_gm" on public.midia_faixas
  for update using (public.is_gm());

create policy "midia_faixas_delete_gm" on public.midia_faixas
  for delete using (public.is_gm());

-- faixa_atual_id é FK de verdade (não jsonb solto como em mapa_publico) — apagar a faixa que
-- tá tocando no momento limpa o estado em vez de deixar um id órfão apontando pro nada.
create table if not exists public.midia_estado (
  id text primary key default 'midia',
  faixa_atual_id uuid references public.midia_faixas(id) on delete set null,
  tocando boolean not null default false,
  posicao_segundos double precision not null default 0,
  modo_loop text not null default 'nenhum',
  atualizado_em timestamptz not null default now(),
  constraint midia_estado_singleton check (id = 'midia'),
  constraint midia_estado_modo_loop_valido check (modo_loop in ('nenhum', 'faixa', 'lista'))
);

alter table public.midia_estado enable row level security;

create policy "midia_estado_select_all" on public.midia_estado
  for select using (true);

create policy "midia_estado_insert_gm" on public.midia_estado
  for insert with check (public.is_gm());

create policy "midia_estado_update_gm" on public.midia_estado
  for update using (public.is_gm());

-- bucket público — download direto por URL, sem checar RLS (public = true já serve os
-- objetos); a policy de select abaixo cobre chamadas autenticadas via SDK (ex.: listagem).
-- insert/update/delete seguem is_gm(), mesmo padrão das tabelas acima.
insert into storage.buckets (id, name, public)
values ('midia', 'midia', true)
on conflict (id) do nothing;

create policy "midia_bucket_select_all" on storage.objects
  for select using (bucket_id = 'midia');

create policy "midia_bucket_insert_gm" on storage.objects
  for insert with check (bucket_id = 'midia' and public.is_gm());

create policy "midia_bucket_update_gm" on storage.objects
  for update using (bucket_id = 'midia' and public.is_gm());

create policy "midia_bucket_delete_gm" on storage.objects
  for delete using (bucket_id = 'midia' and public.is_gm());

alter publication supabase_realtime add table public.midia_faixas;
alter publication supabase_realtime add table public.midia_estado;
