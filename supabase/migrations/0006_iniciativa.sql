-- Ordem de turno (mesa-estatica-multiplayer-completo.md §6.3, Parte IV §5) — faltava:
-- sessao_publica.modo_combate/indice_atual_turno/rodada/condicoes_combate já sincronizam
-- (migração 0004), mas a ORDEM em si (quem vem antes de quem) nunca teve tabela própria —
-- vivia só no store local do GM. `posicao` é explícito porque linhas do Postgres não têm
-- ordem implícita (ao contrário do array `EntradaIniciativa[]` local).
--
-- Escrita é sempre GM (rolar/reordenar/remover iniciativa são ações de mestre); leitura é
-- pública — o jogador precisa ver de quem é a vez.

create table if not exists public.iniciativa (
  id uuid primary key,
  participante_id uuid not null,
  tipo text not null check (tipo in ('pc', 'npc')),
  nome text not null,
  valor integer not null,
  posicao integer not null,
  updated_at timestamptz not null default now()
);

alter table public.iniciativa enable row level security;

create policy "iniciativa_select_all" on public.iniciativa
  for select using (true);

create policy "iniciativa_insert_gm" on public.iniciativa
  for insert with check (public.is_gm());

create policy "iniciativa_update_gm" on public.iniciativa
  for update using (public.is_gm());

create policy "iniciativa_delete_gm" on public.iniciativa
  for delete using (public.is_gm());

alter publication supabase_realtime add table public.iniciativa;
