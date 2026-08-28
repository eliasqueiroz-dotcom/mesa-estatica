-- Soundpad passa de 6 pra 12 botões (mesma área visual — grade 6x2 em vez de 3x2, ver
-- SoundpadGrid.tsx). Nunca editar a constraint da migração 0020 já aplicada — solta e
-- recria com o novo teto. `soundpad_sons.slot` continua sendo só a identidade de posição
-- na grade (já é `unique`, isso não muda).

alter table public.soundpad_sons
  drop constraint if exists soundpad_sons_slot_valido;

alter table public.soundpad_sons
  add constraint soundpad_sons_slot_valido check (slot >= 0 and slot <= 11);
