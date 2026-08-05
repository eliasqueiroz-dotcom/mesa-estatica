-- Auditoria mínima de reuso de link de jogador. `vincular-jogador` é "reatribuível de
-- propósito" (trocar de aparelho com o mesmo link revincula sem drama, doc §6) — não dá pra
-- simplesmente bloquear reuso sem quebrar esse fluxo legítimo. O que faltava era visibilidade:
-- se um link vazar e outra pessoa vinculá-lo, hoje isso acontece em silêncio total.
--
-- Só registra (não bloqueia) — cada vínculo bem-sucedido vira uma linha aqui, com o auth_uid
-- anterior (se houver) e o novo. O mestre pode revisar depois se desconfiar de alguma ficha
-- ("por que o Arthur logou de um auth_uid novo às 23h?"); não tem UI pra isso ainda, é
-- consulta direta no banco por enquanto — "mínima" é o objetivo aqui.

create table if not exists public.vinculo_jogador_log (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null,
  auth_uid_anterior uuid,
  auth_uid_novo uuid not null,
  criado_em timestamptz not null default now()
);

alter table public.vinculo_jogador_log enable row level security;

-- leitura só pro mestre (é auditoria, não dado de jogo); escrita só via service_role dentro
-- da própria Edge Function.
create policy "vinculo_jogador_log_select_gm" on public.vinculo_jogador_log
  for select using (public.is_gm());
