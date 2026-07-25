-- Ameaça/Ruído Narrativo pro jogador (mesa-estatica-multiplayer-completo.md Parte IV §6, Parte 4
-- do plano de paridade) — só o número sobe pra sessao_publica; a UI do jogador nunca renderiza
-- o valor, só reage visualmente (mesmo mecanismo já usado pra Sanidade em RuidoOverlay.tsx).
-- Tensão fica de fora de propósito (decisão do usuário) — continua só em sessaoPrivada.
alter table public.sessao_publica add column if not exists ameaca integer not null default 0;
alter table public.sessao_publica add column if not exists ruido_narrativo integer not null default 0;
