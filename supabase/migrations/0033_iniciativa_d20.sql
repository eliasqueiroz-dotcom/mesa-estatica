-- Iniciativa: guarda o d20 bruto e o modificador de Agilidade usados na rolagem, não só o
-- `valor` somado.
--
-- Sem isso, o tooltip "rolagem iniciativa: d20 X + agilidade Y = valor" (IniciativaPanel.tsx/
-- CombateJogadorView.tsx) nunca tinha os números reais em mesa multiplayer: `paraEntrada`
-- (src/multiplayer/iniciativaSync.ts) reconstrói a entrada só com as colunas que existem aqui,
-- então `d20`/`agilidade` viravam `undefined` em qualquer cliente que lesse do banco (garantido
-- no app do jogador, que só lê via `useIniciativaPublica`).
--
-- Nullable de propósito — linhas antigas (antes desta migração) não têm esses valores e caem
-- no fallback (mostra só `valor`). `select using (true)` (migração 0006) já é público; não
-- expõe nada novo — `valor` já era visível, isso só decompõe o mesmo número.

alter table public.iniciativa
  add column if not exists d20 integer,
  add column if not exists agilidade integer;
