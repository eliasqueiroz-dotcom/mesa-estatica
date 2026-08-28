-- log_publico nunca ganhou policy de update (só select/insert/delete — ver
-- 0013_log_publico_visibilidade.sql). Generalizar o antigo `revelarRoll` (só
-- privada→pública, só rollsLog) pra um toggle bidirecional que também cobre entradas de
-- `log` (narrativo) exige que o mestre consiga alternar a visibilidade de uma entrada JÁ
-- EXISTENTE — sem policy de update, o UPDATE falha contra RLS mesmo sendo o mestre. Mesmo
-- padrão GM-only de rolls_publicas_update_gm (0009_log_rolls_publicos.sql).
create policy "log_publico_update_gm" on public.log_publico
  for update using (public.is_gm());
