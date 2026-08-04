-- Foto real de NPC, subida pelo mestre (precedência sobre a silhueta pré-instalada — ver
-- Avatar.tsx). Pública porque o token do NPC no mapa do jogador (RLS já filtra visivel=true)
-- precisa renderizar igual ao do mestre, mesmo padrão de 0018_npc_silhueta.sql.
alter table public.npcs_publico add column if not exists foto text;
