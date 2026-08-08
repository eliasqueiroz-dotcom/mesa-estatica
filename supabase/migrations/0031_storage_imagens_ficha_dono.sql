-- Migração de imagens (mapa/NPC/ficha) de base64-em-coluna pra Supabase Storage — reusa o
-- bucket 'midia' já existente com prefixo 'img/', mesmo precedente do soundpad
-- (0020_soundpad.sql, "evita um segundo bucket e a duplicação das 4 policies").
--
-- Convenção de path (documentada aqui, não em código, pra qualquer policy futura achar):
--   img/mapa/{uuid}.jpg        — só GM sobe (mesmo dono de mapa_publico).
--   img/npcs/{npcId}/{uuid}.jpg — só GM sobe (mesmo dono de npcs_publico).
--   img/fichas/{fichaId}/{uuid}.jpg — GM OU o dono da ficha.
-- UUID por upload (não determinístico por id) — evita o navegador prender cache numa foto
-- antiga quando alguém troca; o arquivo velho fica órfão no bucket (custo de Storage, não de
-- egress), limpeza é um nice-to-have futuro.
--
-- As 4 policies GM-only de 0008_midia.sql (bucket_id = 'midia', is_gm()) já cobrem
-- img/mapa/* e img/npcs/* sem precisar de nada novo aqui — só GM sobe mapa/NPC hoje.
--
-- Exceção: characters_publico.foto pode ser atualizada pelo DONO da ficha OU o GM
-- (policy "characters_publico_update_dono_ou_gm", 0002_fase_b_fichas.sql:66-70) — o Storage
-- precisa espelhar essa regra pro prefixo img/fichas/, senão o jogador perde a capacidade de
-- trocar a própria foto que já tem hoje na tabela.

create policy "midia_bucket_insert_ficha_dono" on storage.objects
  for insert with check (
    bucket_id = 'midia'
    and (storage.foldername(name))[1] = 'img'
    and (storage.foldername(name))[2] = 'fichas'
    and (storage.foldername(name))[3] in (select id::text from public.characters_privado where auth_uid = auth.uid())
  );

create policy "midia_bucket_update_ficha_dono" on storage.objects
  for update using (
    bucket_id = 'midia'
    and (storage.foldername(name))[1] = 'img'
    and (storage.foldername(name))[2] = 'fichas'
    and (storage.foldername(name))[3] in (select id::text from public.characters_privado where auth_uid = auth.uid())
  );
