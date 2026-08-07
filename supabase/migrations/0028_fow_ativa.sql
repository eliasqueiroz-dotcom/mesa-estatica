-- fow_estado.ativa — liga/desliga a renderização do FoW por mapa (ROADMAP F1, fix pós-lançamento).
--
-- Antes só existia `vistas`/`visiveis_agora`: sem nenhuma região revelada, o mapa aparecia
-- limpo (sem fog nenhuma) — e no primeiro "revelar" o resto do mapa inteiro virava chiado de
-- uma vez, sem jeito de o mestre desligar a ferramenta num mapa que não quer usar FoW (combate,
-- referência) sem perder o que já foi revelado. `ativa=false` por padrão preserva o
-- comportamento de mapas existentes (limpo, sem fog forçado).

alter table public.fow_estado add column if not exists ativa boolean not null default false;
