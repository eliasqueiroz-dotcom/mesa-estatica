-- Defesa pública dos PCs (mesa-estatica-multiplayer-completo.md — combate ao vivo: jogador
-- precisa ver a Defesa de quem tá lutando, não só PV). Antes, FichaPublica não tinha Defesa
-- (nem agilidade/equipamentoModificadorDefesa, que ficam no lado privado) — NPCs já eram
-- 100% públicos nisso. Recomputado a cada push, mesma cadência de pv_maximo hoje.
alter table public.characters_publico add column if not exists defesa integer not null default 10;
