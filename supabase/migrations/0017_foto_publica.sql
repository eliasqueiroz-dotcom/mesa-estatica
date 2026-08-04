-- Foto de perfil do PC (Fichas + overlay "crachás" no mapa do jogador). Data URL JPEG
-- comprimido (~256px, lib/comprimirImagem.ts:comprimirImagemAvatar) — é visual, não segredo,
-- por isso mora em characters_publico junto de nome/cor_visual (mesmo raciocínio de
-- 0010_defesa_publica.sql). RLS de characters_publico já é leitura pública — sem mudança.
alter table public.characters_publico add column if not exists foto text;
