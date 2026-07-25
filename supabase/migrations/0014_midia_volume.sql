-- Volume da música sincronizado — só o GM ajusta (slider em MidiaTab.tsx), todo mundo ouve
-- no mesmo nível. Antes, volume/mudo eram sempre locais por jogador (decisão original do
-- jukebox); pedido do usuário mudou isso só pro volume — mudo continua local, sem coluna aqui.
alter table public.midia_estado
  add column if not exists volume double precision not null default 0.8 check (volume >= 0 and volume <= 1);
