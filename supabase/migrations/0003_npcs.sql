-- NPCs (mesa-estatica-multiplayer-completo.md §4, §6.1, Parte IV §3)
--
-- Mesmo split característica de characters_publico/privado: npcs_publico (superfície de
-- mesa) e npcs_privado (só notasMestre — o único campo que precisa ficar escondido do
-- jogador). RLS é por linha, não por coluna (§3), então "nunca notasMestre" só dá pra
-- garantir separando em tabelas. `visivel` controla a linha inteira de npcs_publico —
-- default oculto, um NPC não revelado não aparece nem no SELECT de um jogador.
--
-- Escrita é sempre GM: "só o mestre cria" (§8) — não existe policy de insert/update/delete
-- pro dono, diferente de characters_*. `controlado_por` (delegação de movimento, §6.2)
-- ainda não existe no client (Npc em state/types.ts não tem esse campo) — fica de fora
-- desta migração até o client implementar.

create table if not exists public.npcs_publico (
  id uuid primary key,
  nome text not null default '',
  cor_visual text not null default '',
  pv_atual integer not null default 0,
  pv_maximo integer not null default 0,
  defesa integer not null default 0,
  agilidade integer not null default 0,
  notas text not null default '',
  categoria text not null default '',
  acoes jsonb not null default '[]'::jsonb,
  visivel boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.npcs_privado (
  id uuid primary key,
  notas_mestre text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.npcs_publico enable row level security;
alter table public.npcs_privado enable row level security;

create policy "npcs_publico_select_visivel_ou_gm" on public.npcs_publico
  for select using (visivel = true or public.is_gm());

create policy "npcs_publico_insert_gm" on public.npcs_publico
  for insert with check (public.is_gm());

create policy "npcs_publico_update_gm" on public.npcs_publico
  for update using (public.is_gm());

create policy "npcs_publico_delete_gm" on public.npcs_publico
  for delete using (public.is_gm());

create policy "npcs_privado_select_gm" on public.npcs_privado
  for select using (public.is_gm());

create policy "npcs_privado_insert_gm" on public.npcs_privado
  for insert with check (public.is_gm());

create policy "npcs_privado_update_gm" on public.npcs_privado
  for update using (public.is_gm());

create policy "npcs_privado_delete_gm" on public.npcs_privado
  for delete using (public.is_gm());

alter publication supabase_realtime add table public.npcs_publico;
alter publication supabase_realtime add table public.npcs_privado;
