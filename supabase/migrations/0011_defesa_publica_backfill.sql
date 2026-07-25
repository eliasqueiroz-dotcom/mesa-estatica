-- 0010 criou characters_publico.defesa com default 10, mas fichas já existentes só recebem a
-- Defesa real recalculada no próximo push local (edição na ficha) — sem esse backfill, jogador
-- veria Defesa errada (10 fixo) até o mestre tocar em cada ficha. `dados` (characters_privado) é
-- jsonb com as chaves originais da Ficha (sem remapeamento snake_case, ver fichaSplit.ts), por
-- isso `atributos.agilidade`/`equipamentoModificadorDefesa` funcionam direto.
update public.characters_publico cp
set defesa = 10
  + coalesce((cpriv.dados -> 'atributos' ->> 'agilidade')::integer, 0)
  + coalesce((cpriv.dados ->> 'equipamentoModificadorDefesa')::integer, 0)
from public.characters_privado cpriv
where cpriv.id = cp.id;
