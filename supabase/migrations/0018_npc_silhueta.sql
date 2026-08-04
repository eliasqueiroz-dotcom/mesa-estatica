-- Silhueta pré-instalada de NPC (slug, ver src/assets/silhuetas/silhuetas.tsx) — pública porque
-- o token do NPC no mapa do jogador (RLS já filtra visivel=true) precisa renderizar igual ao
-- do mestre. Não é imagem — string curta, custo desprezível.
alter table public.npcs_publico add column if not exists silhueta text;
