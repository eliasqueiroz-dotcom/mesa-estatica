-- Fecha o RLS de `tokens`, aberto desde a Fase A (0001) — na época ainda não existia
-- Anonymous Auth nem dono real (isso só chegou na Fase B, migração 0002). A chave anon é
-- pública por natureza (embutida no bundle do cliente); com `using (true)` em
-- insert/update/delete, QUALQUER UM que abrisse o DevTools no site publicado conseguia
-- reescrever ou apagar a posição de token de qualquer personagem, sem precisar ser o mestre
-- nem ter link nenhum — não é hipotético, é uma chamada REST direta.
--
-- Select continua aberto: posição de token não é dado sensível, e todo mundo (jogador
-- incluído) precisa ver o tabuleiro pra jogar.
--
-- Conferido contra o client antes de fechar (04/08): `adicionarTokenMapa`/remoção de token só
-- existem em `MapaTab.tsx` (bundle do mestre — nunca entra no bundle do jogador). O lado do
-- jogador (`MapaJogadorView.tsx`) só chama `moverTokenMapa` no PRÓPRIO token
-- (`meuToken = tokens.find(t => t.participanteId === minhaFicha.id)`) — nunca em outro.

drop policy if exists "tokens_insert_all" on public.tokens;
drop policy if exists "tokens_update_all" on public.tokens;
drop policy if exists "tokens_delete_all" on public.tokens;

-- insert: só o mestre cria token novo — não existe caminho de criação no app do jogador.
create policy "tokens_insert_gm" on public.tokens
  for insert with check (public.is_gm());

-- update: mestre sempre pode; jogador só se for token de PC e a ficha for dele (mesmo padrão
-- de `characters_publico_update_dono_ou_gm`, migração 0002) — a RLS é a garantia real, não
-- só a UI não oferecer o botão.
create policy "tokens_update_dono_ou_gm" on public.tokens
  for update using (
    public.is_gm()
    or (tipo = 'pc' and participante_id in (select id from public.characters_privado where auth_uid = auth.uid()))
  );

-- delete: só o mestre remove token do mapa.
create policy "tokens_delete_gm" on public.tokens
  for delete using (public.is_gm());
