-- Log narrativo + rolagens sincronizados (mesa-estatica-multiplayer-completo.md — "log
-- coerente" é item não-cortável). Até aqui, `log`/`rollsLog` só existiam em Zustand
-- local — mestre e cada jogador viviam numa bolha separada.
--
-- Propositalmente SEPARADO de `rolls_log` (migração 0005) — aquela tabela pertence ao
-- sistema de rolagem forçada (Fase C/D, atrás de flag, ainda não testado com 2 aparelhos
-- reais) e não tem coluna de visibilidade nem RLS por dono. Misturar os dois conceitos
-- arriscaria desestabilizar o mecanismo de sigilo da rolagem forçada.

-- log_publico — narrativa/eventos mecânicos. EntradaLog (state/types.ts) não tem campo de
-- visibilidade — é sempre público, sem exceção (confirmado no doc, Parte IV §5).
create table if not exists public.log_publico (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  personagem_id uuid,
  texto text not null,
  criado_em timestamptz not null default now()
);

alter table public.log_publico enable row level security;

create policy "log_publico_select_all" on public.log_publico
  for select using (true);

create policy "log_publico_insert_all" on public.log_publico
  for insert with check (true);

create policy "log_publico_delete_gm" on public.log_publico
  for delete using (public.is_gm());

alter publication supabase_realtime add table public.log_publico;

-- rolls_publicas — espelha EntradaRoll (state/types.ts), incluindo `visibilidade`, que
-- `rolls_log` não tem. Privada por padrão; "revelar" (GM) vira pública.
create table if not exists public.rolls_publicas (
  id uuid primary key default gen_random_uuid(),
  origem text not null,
  personagem_id uuid,
  formula text not null,
  total integer not null,
  bruto integer not null,
  visibilidade text not null default 'privada' check (visibilidade in ('publica', 'privada')),
  criado_em timestamptz not null default now()
);

alter table public.rolls_publicas enable row level security;

-- select: pública pra todos, OU o mestre vê tudo, OU o dono do personagem vê a própria
-- rolagem privada (personagem_id null — rolagem do mestre sem PC associado — só is_gm() vê
-- se privada, por construção: a cláusula de dono nunca resolve pra null).
create policy "rolls_publicas_select" on public.rolls_publicas
  for select using (
    visibilidade = 'publica'
    or public.is_gm()
    or (
      personagem_id is not null
      and exists (
        select 1 from public.characters_privado cp
        where cp.id = rolls_publicas.personagem_id and cp.auth_uid = auth.uid()
      )
    )
  );

-- Aberto de propósito (mesma postura pragmática já usada em `tokens`) — grupo fechado no
-- Discord é a fronteira real, não RLS airtight. Endurecer depois se algum dia importar.
create policy "rolls_publicas_insert_all" on public.rolls_publicas
  for insert with check (true);

-- só "revelar" (GM) precisa disso — troca visibilidade privada → pública.
create policy "rolls_publicas_update_gm" on public.rolls_publicas
  for update using (public.is_gm());

create policy "rolls_publicas_delete_gm" on public.rolls_publicas
  for delete using (public.is_gm());

alter publication supabase_realtime add table public.rolls_publicas;
