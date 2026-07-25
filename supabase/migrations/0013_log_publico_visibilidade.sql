-- 0009 assumia "EntradaLog não tem campo de visibilidade — é sempre público, sem exceção"
-- (comentário na migração 0009). Errado na prática: registrarLog embute o resultado numérico
-- de uma rolagem PRIVADA no texto livre, sem checar visibilidade (achado ao vivo, 25/07 —
-- rolagem privada de teste vazando pro Log do jogador). O filtro client-side (LogView.tsx/
-- SessaoPublicaView.tsx) só funciona se o campo sobreviver o round-trip pelo Supabase — sem
-- coluna aqui, `visibilidade` se perde no INSERT e o eco do Realtime devolve a entrada sem
-- ela, reabrindo o vazamento pra qualquer cliente real (não só uma simulação local).
--
-- RLS real, mesmo padrão de rolls_publicas (migração 0009) — não é só cosmético client-side,
-- fecha o acesso via devtools/rede também.
alter table public.log_publico
  add column if not exists visibilidade text not null default 'publica' check (visibilidade in ('publica', 'privada'));

drop policy if exists "log_publico_select_all" on public.log_publico;

create policy "log_publico_select_visibilidade" on public.log_publico
  for select using (
    visibilidade = 'publica'
    or public.is_gm()
    or (
      personagem_id is not null
      and exists (
        select 1 from public.characters_privado cp
        where cp.id = log_publico.personagem_id and cp.auth_uid = auth.uid()
      )
    )
  );
