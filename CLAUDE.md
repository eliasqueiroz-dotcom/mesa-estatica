# Mesa de Estática — painel de mestre

Ferramenta local de mestre para o RPG "Estática" (investigação/horror, São Paulo distópica, d20 + atributo + perícia). Uso: tela única do mestre, compartilhada por screen share no Discord. Sem backend, sem auth, sem multiplayer — estado em localStorage com export JSON.

## Documentos de referência (ler antes de implementar a área correspondente)

- [.claude/docs/regras.md](.claude/docs/regras.md) — **fonte da verdade das regras.** Se o código divergir, o código está errado. Não inventar regra.
- [.claude/docs/ficha.md](.claude/docs/ficha.md) — spec campo a campo da ficha (são **15 perícias**, incluindo Erudição).
- [.claude/docs/arte.md](.claude/docs/arte.md) — direção de arte: tokens de design, tipografia, sistema de ruído, microcopy in-world, os 3 clichês proibidos.
- [.claude/docs/arquitetura.md](.claude/docs/arquitetura.md) — stack, estrutura, decisões fechadas.
- [ROADMAP.md](ROADMAP.md) — plano de execução dia a dia, gates e ordem de corte.

## Stack

Vite 8 + React 18 + TypeScript + Zustand(persist) · `@3d-dice/dice-box` (Babylon.js) para dados 3D — **não** `dice-box-threejs`, essa está abandonada, ver `.claude/docs/arquitetura.md` · Three.js para tokens · fontes via @fontsource (self-host). `npm run dev` / `npm run build` / `npm test` (vitest sobre `src/rules/`).

## Regras do projeto

- `src/rules/` é TS puro (sem React/Three) e espelha `regras.md`; toda regra nova ganha teste.
- Rolagem de dados é **honesta**: valor bruto vem da física (`onRollComplete`); modificadores somados depois. Nunca usar a notação de resultado forçado (`1d20@X`).
- Textos de UI em pt-BR, seguindo o vocabulário de microcopy de `arte.md` — sem exclamações, sem emoji, log em minúsculas mono.
- Nada pode depender de internet em runtime (fontes, libs, assets — tudo local). O app precisa rodar offline no dia da sessão.
- Antes de marcar um dia do roadmap como concluído, passar no **gate** daquele dia.
