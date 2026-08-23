-- Tag livre por faixa do jukebox, pro mestre organizar/buscar a playlist ("tensão", "combate"...)
-- na aba Mídia. Aditiva, nullable — faixas existentes ficam sem tag até o mestre preencher.
alter table public.midia_faixas
  add column if not exists tag text;
