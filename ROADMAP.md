# ROADMAP — Mesa de Estática

> Painel de controle do mestre para a sessão de Estática: ficha viva, motor de regras real, dados 3D físicos, mapa com tokens, e uma interface que pertence ao mundo do jogo.
> Sessão-alvo: **~25/07/2026** (uma semana). Docs de referência: [regras](.claude/docs/regras.md) · [ficha](.claude/docs/ficha.md) · [arte](.claude/docs/arte.md) · [arquitetura](.claude/docs/arquitetura.md).

## O que mudou em relação ao plano original (e por quê)

1. **Erudição existe.** O plano listava 14 perícias; a ficha oficial tem **15** (Erudição, Intelecto). Corrigido em `ficha.md`.
2. **Contradição dados 3D resolvida.** O plano pedia física honesta na seção 4 e resultado determinístico na seção 7. Decisão: **física honesta** — o motor soma modificadores sobre o valor bruto. Detalhe em `arquitetura.md`.
3. **Spike dos dados 3D antecipado para o Dia 1.** Era o maior risco técnico agendado para o Dia 4 — se a lib falhasse, sobrava 1 dia de folga. Agora falha cedo e barato.
4. **Regras que o plano ignorou e a mesa vai usar**: Ferido dá **-2 mecânico** (não é só badge), Surto dispara com **perda ≥5 de uma vez**, Trauma tem teste Vontade DT 12 com escolha na falha, e a ficha oficial rastreia **neuro-reguladores** (doses, Dependência, contador de Acessos — ferramenta de mestre valiosíssima: "gasta na pior hora possível").
5. **Tokens 3D não compartilham a cena dos dados.** A dice-box encapsula o próprio renderer; os tokens ganham uma cena Three.js leve e separada (mesma stack, cena própria). O plano prometia reaproveitamento que não existe.
6. **Export/Import JSON obrigatório.** localStorage é frágil demais para ser o único guardião da sessão. Backup entra no checklist do dia.
7. **Fallback 2D dos dados.** Se WebGL falhar no meio da sessão, rolagem via `crypto.getRandomValues` com animação CSS. O jogo nunca trava por causa do 3D.
8. **Microcopy in-world como requisito, não enfeite** — é a arma principal contra a cara de "gerado por IA". Vocabulário canônico em `arte.md`.
9. **A lib de dados recomendada estava abandonada.** Achado no spike do Dia 1: `@3d-dice/dice-box-threejs` não recebe release desde 2022. Trocado para `@3d-dice/dice-box` (Babylon.js + Ammo.js, mesmo time, mantida até 2024). Sem tipos TS publicados — declaração escrita à mão em `src/dice/dice-box.d.ts`. Detalhes completos em `arquitetura.md`.

---

## Dia 1 — Fundação + spike de risco ✅ concluído

- [x] Scaffold: Vite 8 + React 18 + TS + Zustand(persist); `git init`; tokens de design (`tokens.css`) e fontes self-host (@fontsource).
- [x] Modelo de dados completo (`src/state/types.ts`, `factories.ts`, `store.ts`) com `schemaVersion`, CRUD de fichas/NPCs/log, e export/import JSON.
- [x] Tabelas do jogo tipadas em `src/rules/data/`: 15 perícias, Surto×20, Traumas×20, armas×9+proteções, antecedentes×8, DTs/dificuldades.
- [x] **Spike de dados 3D**: `@3d-dice/dice-box-threejs` estava abandonada (última release 2022) — trocado por `@3d-dice/dice-box` (Babylon.js, mantida). Instalada, assets copiados manualmente (`public/assets/dice-box/`), tipos declarados à mão (`src/dice/dice-box.d.ts`), componente de teste em `src/dice/DiceSpike.tsx`.
- [x] **Gate passou**: 10 rolagens consecutivas no navegador real (d4, d6, d8, d10, d12, d20×3, d100, 2d8) via `onRollComplete`, valores honestos e variados, zero erros de console, todos os assets 200 OK.

**Nota de ambiente**: Node.js não estava instalado na máquina — instalado via `winget install OpenJS.NodeJS.LTS` (v24.18.0) com autorização do usuário. `npm audit` inicial acusou 5 vulnerabilidades (todas do dev-server, Vite/Vitest/esbuild) — corrigido subindo para Vite 8.1.5 + Vitest 4.1.10 (0 vulnerabilidades). Pasta ainda não é um repositório git.

## Dia 2 — Ficha completa

- [ ] Todos os campos de `ficha.md`: identidade, vínculos, atributos, derivados auto (com dial de letalidade), 15 perícias com toggles, traumas/cicatrizes, equipamento, armas com presets, reguladores/Acessos/Dependência, dinheiro R$/P$ com botões rápidos, anotações.
- [ ] Indicadores mecânicos: Ferido (-2), linha da metade da Sanidade (detecção de cruzamento descendo), alerta de Surto (perda ≥5), aviso 3+ Traumas.
- [ ] Multi-ficha (uma por jogador) + ficha ativa.
- **Gate**: criar as fichas reais dos jogadores da mesa sem tocar em devtools; fechar e reabrir o navegador sem perder nada.

## Dia 3 — Motor de regras + log (sem 3D ainda)

- [ ] `rules/`: teste padrão (d20+atrib+perícia vs DT, margem 10+, 20/1 natural, Ferido aplicado), teste de Sanidade (1d4/1d8/2d8, sucesso=metade, aplica na ficha), Surto (2×d20, escolha lado a lado, "o destino insiste"), gatilho de Trauma (Vontade DT 12 + escolha na falha), iniciativa (d20+Agilidade), ataque/dano (corpo a corpo soma Vigor, margem 10+ = dano máximo).
- [ ] Log da sessão: append-only, timestamp mono, toda rolagem e todo delta de PV/Sanidade/dinheiro/Determinação.
- [ ] Testes vitest das regras contra `regras.md`.
- **Gate**: simular uma cena por texto puro (teste → dano → sanidade → surto) só clicando botões; log conta a história completa.

## Dia 4 — Dados 3D integrados

- [ ] Wrapper de produção sobre o spike: fila de rolagens, colorsets `rede`/`ruído`, overlay de rolagem acessível de qualquer aba, fallback 2D automático.
- [ ] Motor plugado: rolagem física → valor bruto → soma → classificação → log.
- [ ] Atalhos: `R` d20 rápido · `S` sanidade · `1–6` abas.
- **Gate**: 20 rolagens seguidas sem travar, sem dessincronia física×log, em janela compartilhada no Discord (testar screen share de verdade).

## Dia 5 — Mapa, tokens, NPCs, sessão

- [ ] Mapa: upload de imagem (comprimida p/ localStorage), tokens arrastáveis em coordenadas normalizadas.
- [ ] Tokens 3D: cristal low-poly com cor+inicial; suporte a `.glb` de `assets/faces/` com fallback placa+scanline; jitter em Sanidade crítica.
- [ ] NPCs & Iniciativa: lista com PV/Defesa/notas, tabela de iniciativa ordenável misturando PCs e NPCs.
- [ ] Aba Sessão: nome da mesa, nº da sessão, cena atual editável ao vivo, garoa/hora.
- **Gate**: montar uma cena de combate completa (mapa + 4 tokens + 3 NPCs + iniciativa) em menos de 3 minutos.

## Dia 6 — Identidade visual total

- [ ] Sistema de ruído por tiers ligado à Sanidade da ficha ativa (`arte.md`), incluindo burst de Surto.
- [ ] Passada completa de UI: tipografia, cores rede/real/ruído por contexto, barras segmentadas com linha da metade, microcopy in-world em todos os estados (vazios, confirmações, toasts).
- [ ] Performance: rAF pausado fora da aba, devicePixelRatio limitado, teste em screen share.
- **Gate**: o teste do espelho de `arte.md` — mostrar um print a alguém e não ouvir "feito por IA". Checar os 3 clichês proibidos.

## Dia 7 — Playtest e folga

- [ ] Simular uma sessão inteira sozinho (investigação → combate → surto → downtime), corrigindo o que atritar.
- [ ] README com o comando de subir offline (`npx serve dist`) e o checklist do dia.
- [ ] Folga real — é o buffer se o Dia 4 ou 5 estourar.

---

## Ordem de corte (se o tempo apertar)

1. Rostos `.glb` escaneados (fica o cristal/crachá — já é ótimo)
2. Tokens 3D → divs coloridas (só troca a camada visual; drag não muda)
3. NPCs/Iniciativa vira lista simples
4. **Não se cortam**: identidade visual + ruído, dados (3D ou fallback digno), motor de regras fiel, log.

## Riscos

| Risco | Mitigação |
|---|---|
| lib de dados 3D incompatível/abandonada | ~~mitigado no Dia 1~~: `dice-box-threejs` estava abandonada, trocada por `@3d-dice/dice-box` — validada e funcionando. Fallback 2D permanente continua no plano por segurança |
| localStorage apagado antes da sessão | export JSON no checklist; autosave testado no Dia 2 |
| Screen share derrete performance | teste real no Discord nos gates dos Dias 4 e 6 |
| Ruído visual atrapalha leitura | tiers discretos; regra de legibilidade em `arte.md` |
| Escopo crescer no meio da semana | Fase 2 (cenas Marble/World Labs) só depois do Dia 7 — é upside, não meta |

## Checklist do dia da sessão (25/07)

- [ ] `npm run build` + `npx serve dist` funcionando **offline** (desligar wifi e testar)
- [ ] Export JSON de backup salvo fora do navegador
- [ ] Fichas dos jogadores conferidas contra as fichas de papel deles
- [ ] Mapa(s) do caso já importado(s), NPCs pré-cadastrados
- [ ] Discord: compartilhar a **janela** do navegador (não a tela), 1080p, modo "otimizar para vídeo" desligado
- [ ] Determinação de todos resetada para 1 ("abrir turno")
- [ ] d20 físico na mesa por garantia — *fé no rolador do navegador, mas o papel não esquece*
