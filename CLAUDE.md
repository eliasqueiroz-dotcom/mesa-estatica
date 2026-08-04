# Mesa de Estática — painel de mestre

Painel de mestre do RPG "Estática" (investigação/horror, São Paulo distópica, d20 + atributo + perícia). Tela do mestre compartilhada por screen share no Discord + app reduzido do jogador (`jogador.html`). Estado local em localStorage (Zustand persist) com export JSON, mais sync opcional via Supabase. Publicado no GitHub Pages.

## Documentos de referência (Grep pela seção — nunca ler o arquivo inteiro)

- [.claude/docs/regras.md](.claude/docs/regras.md) — **fonte da verdade das regras.** Se o código divergir, o código está errado. Não inventar regra.
- [.claude/docs/ficha.md](.claude/docs/ficha.md) — spec campo a campo da ficha (**15 perícias**, incluindo Erudição).
- [.claude/docs/arte.md](.claude/docs/arte.md) — design tokens, tipografia, sistema de ruído, microcopy, os 3 clichês proibidos.
- [.claude/docs/arquitetura.md](.claude/docs/arquitetura.md) — stack e decisões fechadas.
- [mesa-estatica-multiplayer-completo.md](mesa-estatica-multiplayer-completo.md) — spec do multiplayer (Supabase, RLS, Edge Functions); comentários no código citam suas seções (§11, Parte IV…).
- [ROADMAP.md](ROADMAP.md) — o que já foi feito e o que vem a seguir.

## Stack

Vite 8 + React 18 + TS + Zustand(persist) · `@3d-dice/dice-box-threejs` nos dados 3D (escolhido por suportar rolagem forçada nativa `1d20@X`) · Three.js nos tokens · @fontsource self-host · `docx` no export de ficha · Supabase (Realtime + Edge Functions) opcional.

`npm run dev` · `build` · `preview` · `test` (vitest) · `test:watch`. CI: push em `main` → build + test → deploy no GitHub Pages.

## Convenções

- `src/rules/` é TS puro (sem React/Three) e espelha `regras.md`; **toda regra nova ganha teste**. `src/rules/data/` guarda as tabelas tipadas do jogo.
- `src/state/store.ts` = Zustand + persist + migrations. **Toda mudança de shape bumpa `SCHEMA_VERSION` (`factories.ts`) e ganha bloco em `migrate`.**
- **Rolagem é honesta por padrão** (valor bruto vem da física, modificadores somados depois). Exceção deliberada: o mestre força pela janela secreta `#controle` (`src/dice/forcarRolagem.ts`) — nunca expor esse controle na janela compartilhada. Fallback 2D se WebGL falhar.
- `src/features/` = uma pasta por aba. Abas usam `visibility`/`pointer-events`, não render condicional, pra preservar estado local (`App.tsx`).
- Bundle do jogador (`jogador.html` → `PlayerApp.tsx`) nunca importa código exclusivo de mestre — o sigilo depende disso.
- `src/hooks/useIniciativa.ts` + `features/iniciativa/IniciativaPanel.tsx` centralizam iniciativa/combate (usados por `CombatOverlay` e `NpcsTab`).
- Ruído visual global: tiers 0–3 via `data-ruido` no `<html>` (`features/ruido/RuidoOverlay.tsx`), CSS puro, dirigido pela Sanidade da ficha ativa.
- UI em pt-BR seguindo a microcopy de `arte.md`: sem exclamação, sem emoji, log em minúsculas mono.
- Assets/libs 100% locais (sem CDN em runtime). Sem `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` o app roda 100% local, sem multiplayer.
- **Portabilidade é requisito**: esta máquina de dev NÃO é a da sessão. Tudo tem que funcionar num clone limpo com `npm install && npm run dev`. Nunca versionar caminho absoluto; estado migra por export/import JSON. Antes de fechar um item do roadmap: "isso funcionaria num clone limpo?"

## Economia de tokens (pedido do usuário — sessões devem ser baratas)

- **Docs por trecho**: Grep pela seção, nunca o arquivo inteiro. ROADMAP: `grep "^## "` e ler só a seção relevante (histórico concluído está comprimido de propósito; detalhe fica no `git log`).
- **Vitest antes de navegador**: lógica valida com `npm test` (barato). Navegador só pro visual/interativo, **uma rodada por feature** — não por edit.
- **No navegador**: `read_console_messages(onlyErrors)` e `get_page_text`/`find` antes de `read_page` (a árvore repete as 15 perícias em cada select — cara). Screenshot só quando a confirmação precisa ser visual.
- **HMR conhecido**: "Invalid hook call"/"change in the order of Hooks" em aba antiga depois de editar hook NÃO é bug — abrir UMA aba nova e seguir, não investigar.
- **Escrita enxuta**: commits e entradas de ROADMAP em 1–3 frases (o quê + por quê); o detalhe fica no diff.
