-- Biblioteca de mapas — o mestre sobe vários mapas e escolhe qual está ativo a qualquer
-- momento (ROADMAP "Próximos passos — mesa ao vivo"). Grid e Fog of War passam a ser
-- lembrados POR MAPA (decisão do usuário) — cada um vive junto da imagem, não mais num
-- singleton solto. Tokens continuam globais, sem vínculo com o mapa ativo (tabela `tokens`
-- não muda aqui).
--
-- mapas_biblioteca — lista (mesmo padrão de `midia_faixas`, 0008_midia.sql): sem dono, sync
-- por diff, RLS aberta pra leitura e is_gm() pra escrita.
create table public.mapas_biblioteca (
  id uuid primary key default gen_random_uuid(),
  nome text not null default '',
  imagem_path text not null,
  imagem_url text not null,
  grade jsonb not null default '{"ativa":false,"x":0,"y":0,"largura":100,"altura":100,"colunas":10,"linhas":10,"escala":1.5,"unidade":"m"}'::jsonb,
  fow jsonb not null default '{"vistas":[],"visiveisAgora":[],"zonaAtual":null,"ativa":false}'::jsonb,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);

alter table public.mapas_biblioteca enable row level security;

create policy "mapas_biblioteca_select_all" on public.mapas_biblioteca
  for select using (true);

create policy "mapas_biblioteca_insert_gm" on public.mapas_biblioteca
  for insert with check (public.is_gm());

create policy "mapas_biblioteca_update_gm" on public.mapas_biblioteca
  for update using (public.is_gm());

create policy "mapas_biblioteca_delete_gm" on public.mapas_biblioteca
  for delete using (public.is_gm());

alter publication supabase_realtime add table public.mapas_biblioteca;

-- backfill: o mapa em uso hoje (imagem+grade em mapa_publico, revelação em fow_estado) vira o
-- primeiro item da biblioteca — não perde o mapa da sessão de produção na migração.
insert into public.mapas_biblioteca (nome, imagem_path, imagem_url, grade, fow, ordem)
select
  'mapa importado',
  '', -- path desconhecido pra imagens já migradas antes desta tabela existir (só a URL foi guardada) — nunca vai ter delete-do-Storage automático pra este item específico, aceitável (é o único caso).
  mp.imagem_data_url,
  coalesce(mp.grade, '{"ativa":false,"x":0,"y":0,"largura":100,"altura":100,"colunas":10,"linhas":10,"escala":1.5,"unidade":"m"}'::jsonb),
  coalesce(
    (select jsonb_build_object('vistas', fe.vistas, 'visiveisAgora', fe.visiveis_agora, 'zonaAtual', fe.proximo_id_zona, 'ativa', coalesce(fe.ativa, false))
     from public.fow_estado fe where fe.id = 'fow'),
    '{"vistas":[],"visiveisAgora":[],"zonaAtual":null,"ativa":false}'::jsonb
  ),
  0
from public.mapa_publico mp
where mp.id = 'mapa' and mp.imagem_data_url is not null;

-- mapa_publico vira só o ponteiro "qual mapa está ativo" (mesmo papel de
-- midia_estado.faixa_atual_id) — imagem/grade agora vivem em mapas_biblioteca.
alter table public.mapa_publico add column mapa_ativo_id uuid references public.mapas_biblioteca(id) on delete set null;

update public.mapa_publico
set mapa_ativo_id = (select id from public.mapas_biblioteca order by criado_em asc limit 1)
where id = 'mapa';

alter table public.mapa_publico drop column imagem_data_url;
alter table public.mapa_publico drop column grade;

-- fow_estado retirado — FoW agora é por mapa (mapas_biblioteca.fow), não singleton.
drop table public.fow_estado;
