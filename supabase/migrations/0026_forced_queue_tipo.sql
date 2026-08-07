-- Tipo de rolagem na fila forçada (Fase D), espelhando o que a fila local por BroadcastChannel
-- passou a ter em `src/dice/forcarRolagem.ts`.
--
-- Por quê: o consumo é destrutivo e por primeira-correspondência, então enquanto a única chave
-- era o personagem, um valor guardado pro d20 de um teste podia ser consumido pela primeira
-- iniciativa/dano que rolasse antes — foi o que manteve vários pontos de rolagem (iniciativa,
-- ação de NPC, dano de arma, surto automático) fora da fila até agora. Com o tipo, cada entrada
-- só casa com a categoria certa.
--
-- Default 'qualquer' preserva o comportamento antigo pra qualquer linha que já exista: casa com
-- todas as rolagens, exatamente como antes da coluna.

alter table public.forced_queue
  add column if not exists tipo text not null default 'qualquer';

alter table public.forced_queue
  drop constraint if exists forced_queue_tipo_valido;

alter table public.forced_queue
  add constraint forced_queue_tipo_valido
  check (tipo in ('qualquer', 'teste', 'iniciativa', 'dano', 'sanidade', 'surto'));
