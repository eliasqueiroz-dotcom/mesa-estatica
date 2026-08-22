-- Fecha o vazamento de NPC oculto na iniciativa multiplayer: `iniciativa` tinha
-- `for select using (true)` (migração 0006), sem cruzar com `npcs_publico.visivel` como
-- `npcs_publico` já faz (migração 0003) — um jogador inspecionando a rede ou fazendo sua
-- própria query com a anon key ainda lia nome/participante_id de um NPC "oculto" durante
-- combate, mesmo com a máscara client-side em CombateJogadorView.tsx escondendo isso NA TELA.
--
-- Pré-requisito client-side já feito: `sessao_publica.indice_atual_turno` (índice de array)
-- virou `turno_atual_id` (id da entrada de iniciativa) — um índice numérico desalinharia assim
-- que esta policy passasse a omitir linhas de NPC oculto pro jogador (array do jogador mais
-- curto que o do mestre). Esta migração acompanha a mesma troca no banco.

alter table public.sessao_publica add column turno_atual_id uuid;

update public.sessao_publica sp
set turno_atual_id = i.id
from public.iniciativa i
where sp.modo_combate = true and i.posicao = sp.indice_atual_turno;

alter table public.sessao_publica drop column indice_atual_turno;

drop policy "iniciativa_select_all" on public.iniciativa;

create policy "iniciativa_select_visivel_ou_gm" on public.iniciativa
  for select using (
    tipo = 'pc'
    or exists (
      select 1 from public.npcs_publico np
      where np.id = participante_id and np.visivel = true
    )
    or public.is_gm()
  );
