-- Soundpad: permite parar um efeito em execução, não só disparar.
--
-- `disparo_slot`/`disparo_em` (0020) já eram um EVENTO carimbado; `disparo_tipo` só distingue
-- os dois comandos que passam por ele — cada cliente compara o carimbo `disparo_em` com o
-- último que já processou e age só se for mais novo (mesma regra de sempre, sem mudança).
-- 'tocar' começa o efeito; 'parar' pede pra cada cliente interromper sua PRÓPRIA instância
-- local daquele slot, se estiver tocando aí (estado de "tocando" é local por cliente, não
-- sincronizado — cada um tem seu próprio elemento <audio>; ver src/state/soundpadUiStore.ts).

alter table public.soundpad_estado
  add column if not exists disparo_tipo text not null default 'tocar';

alter table public.soundpad_estado
  add constraint soundpad_estado_disparo_tipo_valido check (disparo_tipo in ('tocar', 'parar'));
