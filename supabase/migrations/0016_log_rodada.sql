-- Filtro "por rodada" no log de combate (PLANO_REGUA_E_COMBATE.md, item pós-implementação) —
-- `registrarLog` (store.ts) carimba a rodada atual quando `modoCombate` está ligado; a maioria
-- das entradas (fora de combate) não tem rodada, por isso nullable e sem default.
alter table public.log_publico
  add column if not exists rodada integer;
