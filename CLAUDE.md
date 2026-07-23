# Mesa de Estática — painel de mestre

Ferramenta local de mestre para o RPG "Estática" (investigação/horror, São Paulo distópica, d20 + atributo + perícia). Uso: tela única do mestre, compartilhada por screen share no Discord. Sem backend, sem auth, sem multiplayer — estado em localStorage com export JSON.

## Documentos de referência (ler antes de implementar a área correspondente)

- [.claude/docs/regras.md](.claude/docs/regras.md) — **fonte da verdade das regras.** Se o código divergir, o código está errado. Não inventar regra.
- [.claude/docs/ficha.md](.claude/docs/ficha.md) — spec campo a campo da ficha (são **15 perícias**, incluindo Erudição).
- [.claude/docs/arte.md](.claude/docs/arte.md) — direção de arte: tokens de design, tipografia, sistema de ruído, microcopy in-world, os 3 clichês proibidos.
- [.claude/docs/arquitetura.md](.claude/docs/arquitetura.md) — stack, estrutura, decisões fechadas.
- [ROADMAP.md](ROADMAP.md) — plano de execução dia a dia, gates e ordem de corte.

## Stack

Vite 8 + React 18 + TypeScript + Zustand(persist) · `@3d-dice/dice-box-threejs` (Three.js + cannon-es) para dados 3D — escolhido por suportar **rolagem forçada nativa** (`1d20@X`), necessária para o modo determinístico do mestre; ver `.claude/docs/arquitetura.md` · Three.js para tokens · fontes via @fontsource (self-host). `npm run dev` / `npm run build` / `npm run preview` / `npm test` (vitest sobre `src/rules/` e `src/dice/`) / `npm run test:watch`.

## Regras do projeto

- `src/rules/` é TS puro (sem React/Three) e espelha `regras.md`; toda regra nova ganha teste. `src/rules/data/` contém tabelas do jogo tipadas (surto, traumas, armas, antecedentes, pericias, condicoesCombate, dificuldades).
- `src/state/store.ts` concentra o Zustand com persist + migrations; `schemaVersion` em `factories.ts` — toda mudança de shape bumpa a versão e ganha bloco `migrate`. `rollsLog` é separado do log narrativo com toggle privado/público. `Ficha.surtosAtivos: SurtoAtivo[]` (array) substituiu os campos individuais `surtoAtivo: number | null` + `surtoEscolha: string | null` — permite múltiplos surtos simultâneos. `SCHEMA_VERSION` atual (factories.ts).
- Rolagem de dados é **honesta por padrão** (valor bruto vem da física; modificadores somados depois). **Exceção deliberada**: o mestre pode forçar um resultado pela janela de controle secreta (`#controle`, fora da tela compartilhada) — a lib faz swap da face via `1d20@X`, indistinguível na tela. Fluxo em `src/dice/forcarRolagem.ts` + `useDiceBox.ts`; nunca expor esse controle na janela principal. Fallback 2D automático em `rolarFallback2D` se WebGL falhar.
- `src/features/` organiza uma pasta por aba: `sessao/`, `fichas/`, `dados/`, `mapa/`, `npcs/`, `ruido/`, `controle/`. Cada aba usa `visibility`/`pointer-events` em vez de renderização condicional para preservar estado local (App.tsx).
- `src/hooks/useIniciativa.ts` centraliza lógica de iniciativa/combate (PV, Defesa, seleção, drag-and-drop, ações de NPC). `src/features/iniciativa/IniciativaPanel.tsx` é o componente compartilhado usado em `CombatOverlay` e `NpcsTab`, com prop `podeArrastar` para habilitar drag-and-drop.
- `src/rules/surto.ts`: `personagemEstaEmSurto` recebe `SurtoAtivo[]` (antes `number | null`). `surto.test.ts` testa múltiplos surtos ativos simultâneos.
- `src/rules/teste.ts`: exporta `descricaoResultado` (string de resultado: "sucesso", "falha", "1 natural — complicação", "20 natural — margem garantida", "margem 10+ — efeito extra"). Testada em `teste.test.ts`.
- Rolagem livre (`RolagemLivre.tsx`) não trava mais no modo `'nenhum'` — permite rolar sem selecionar personagem/NPC, e ainda loga a rolagem em `rollsLog`.
- `ReguladoresSection.tsx`: `numeroSessao` → `contadorCena` (o campo da dose agora referencia cena, não sessão).
- `ControlPanel.tsx` inclui NPCs como alvo de rolagem forçada. A fila de forçados usa `assinar`/`filaAtual` do módulo e sincroniza via BroadcastChannel com merge.
- Ruído visual global em `features/ruido/RuidoOverlay.tsx` — tiers 0–3 (`data-ruido` no `<html>`) controlados pela Sanidade da ficha ativa, CSS puro. `AlertaOverlay.tsx` mostra gauges de Ruído Narrativo/Ameaça.
- `CombatOverlay.tsx` no mapa — modo combate por turnos com seleção de combatentes, condições, drag-and-drop de reordenação, steppers PV/Defesa.
- Textos de UI em pt-BR, seguindo o vocabulário de microcopy de `arte.md` — sem exclamações, sem emoji, log em minúsculas mono.
- Fontes/libs/assets continuam 100% locais (sem CDN em runtime). O requisito "roda sem internet" agora vale só pro **fallback GM-solo**: a partir da Fase A do multiplayer (`mesa-estatica-multiplayer-completo.md` §11, Parte V), a sincronização de tokens depende de conexão com o Supabase — sem `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (`src/lib/supabaseClient.ts`) o app roda 100% local como antes, sem multiplayer.
- `src/multiplayer/tokensSync.ts` (Fase A): sincroniza `mapa.tokens` via Supabase Realtime — Zustand continua a fonte local/otimista, Supabase é a fonte compartilhada por cima. Diff puro e testado em `tokensDiff.ts`/`tokensDiff.test.ts`. Iniciado uma vez no boot do `App.tsx`; sem env vars, é no-op. RLS da tabela `tokens` ainda é aberta nesta fase (sem Anonymous Auth) — ver aviso em `supabase/migrations/0001_fase_a_tokens.sql`.
- **Portabilidade é requisito**: esta máquina de dev NÃO é a máquina da sessão. Tudo deve funcionar num clone limpo com `npm install` + `npm run dev` (o postinstall recria os assets 3D). Nunca versionar caminhos absolutos desta máquina; estado da mesa migra via export/import JSON (localStorage não viaja). Setup da máquina nova documentado no [README.md](README.md).
- Antes de marcar um dia do roadmap como concluído, passar no **gate** daquele dia — incluindo a pergunta: "isso funcionaria num clone limpo?"

## Economia de tokens (pedido do usuário — sessões devem ser baratas)

- **Docs sob demanda e por trecho**: nunca ler `regras.md`/`arquitetura.md` inteiros — Grep pela seção. ROADMAP: `grep "^## "` + ler só a seção do dia atual (o histórico concluído está comprimido de propósito; detalhe fica no `git log`).
- **Vitest antes de navegador**: lógica valida-se com `npm test` (barato). Navegador só para o que é visual/interativo, **uma rodada por feature** — não por edit.
- **No navegador**: `read_console_messages(onlyErrors)` e `get_page_text`/`find` antes de `read_page` (as árvores repetem as 15 perícias em cada select — caras). Screenshot no máximo 1–2 por feature, só quando a confirmação precisa ser visual.
- **Artefato conhecido de HMR**: erros "Invalid hook call"/"change in the order of Hooks" numa aba antiga depois de editar hooks NÃO são bug — abrir UMA aba nova e seguir; não investigar. Reiniciar o dev server (via preview_start) a cada dia de roadmap; não acumular abas.
- **Escrita enxuta**: commits e entradas de ROADMAP curtos (o quê + por quê em 1–3 frases); o detalhe fica no diff.
