-- Duração opcional (em rodadas) por condição de combate ativa (Fase 2 do
-- PLANO_REGUA_E_COMBATE.md) — participanteId -> condicaoId -> rodadasRestantes. Ausência de
-- entrada = condição manual/persistente, sem prazo (comportamento original de
-- condicoes_combate, que fica intocado). `default '{}'::jsonb` já backfila linhas existentes,
-- sem UPDATE manual — coluna nova, sem dados prévios que dependam de outro valor.
alter table public.sessao_publica
  add column if not exists condicao_duracao jsonb not null default '{}'::jsonb;
