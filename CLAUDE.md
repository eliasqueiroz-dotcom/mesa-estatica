# Mesa de Estática — painel de mestre

Ferramenta local de mestre para o RPG "Estática" (investigação/horror, São Paulo distópica, d20 + atributo + perícia). Uso: tela única do mestre, compartilhada por screen share no Discord. Sem backend, sem auth, sem multiplayer — estado em localStorage com export JSON.

## Documentos de referência (ler antes de implementar a área correspondente)

- [.claude/docs/regras.md](.claude/docs/regras.md) — **fonte da verdade das regras.** Se o código divergir, o código está errado. Não inventar regra.
- [.claude/docs/ficha.md](.claude/docs/ficha.md) — spec campo a campo da ficha (são **15 perícias**, incluindo Erudição).
- [.claude/docs/arte.md](.claude/docs/arte.md) — direção de arte: tokens de design, tipografia, sistema de ruído, microcopy in-world, os 3 clichês proibidos.
- [.claude/docs/arquitetura.md](.claude/docs/arquitetura.md) — stack, estrutura, decisões fechadas.
- [ROADMAP.md](ROADMAP.md) — plano de execução dia a dia, gates e ordem de corte.

## Stack

Vite 8 + React 18 + TypeScript + Zustand(persist) · `@3d-dice/dice-box-threejs` (Three.js + cannon-es) para dados 3D — escolhido por suportar **rolagem forçada nativa** (`1d20@X`), necessária para o modo determinístico do mestre; ver `.claude/docs/arquitetura.md` · Three.js para tokens · fontes via @fontsource (self-host). `npm run dev` / `npm run build` / `npm test` (vitest sobre `src/rules/`).

## Regras do projeto

- `src/rules/` é TS puro (sem React/Three) e espelha `regras.md`; toda regra nova ganha teste.
- Rolagem de dados é **honesta por padrão** (valor bruto vem da física; modificadores somados depois). **Exceção deliberada**: o mestre pode forçar um resultado pela janela de controle secreta (`#controle`, fora da tela compartilhada) — a lib faz swap da face via `1d20@X`, indistinguível na tela. Fluxo em `src/dice/forcarRolagem.ts` + `useDiceBox.ts`; nunca expor esse controle na janela principal.
- Textos de UI em pt-BR, seguindo o vocabulário de microcopy de `arte.md` — sem exclamações, sem emoji, log em minúsculas mono.
- Nada pode depender de internet em runtime (fontes, libs, assets — tudo local). O app precisa rodar offline no dia da sessão.
- **Portabilidade é requisito**: esta máquina de dev NÃO é a máquina da sessão. Tudo deve funcionar num clone limpo com `npm install` + `npm run dev` (o postinstall recria os assets 3D). Nunca versionar caminhos absolutos desta máquina; estado da mesa migra via export/import JSON (localStorage não viaja). Setup da máquina nova documentado no [README.md](README.md).
- Antes de marcar um dia do roadmap como concluído, passar no **gate** daquele dia — incluindo a pergunta: "isso funcionaria num clone limpo?"

## Estado atual da sessão (18/07/2026)

- Correção aplicada na shell de abas: a tela de dados deixou de ser desmontada ao trocar para outras abas, evitando o reset dos estados locais dos roladores e do container da mesa de dados.
- Causa raiz confirmada: renderização condicional que removia `DadosTab` do árbol de React; ao voltar, `useState` e a instância da cabine `useDiceBox` eram recriados e o dado desaparecia.
- Ajuste adotado: manter a aba montada e alternar apenas a visibilidade com `display` no componente principal (`App.tsx`).
- Verificação: `npm run build` passou após o ajuste.
