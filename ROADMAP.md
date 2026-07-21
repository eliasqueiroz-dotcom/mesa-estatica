# ROADMAP — Mesa de Estática

> Painel de controle do mestre para a sessão de Estática: ficha viva, motor de regras real, dados 3D físicos, mapa com tokens, e uma interface que pertence ao mundo do jogo.
> Sessão-alvo: **~25/07/2026** (uma semana). Docs de referência: [regras](.claude/docs/regras.md) · [ficha](.claude/docs/ficha.md) · [arte](.claude/docs/arte.md) · [arquitetura](.claude/docs/arquitetura.md).

## O que mudou em relação ao plano original (e por quê)

1. **Erudição existe.** O plano listava 14 perícias; a ficha oficial tem **15** (Erudição, Intelecto). Corrigido em `ficha.md`.
2. **Contradição dados 3D resolvida.** Decisão final (revertida a pedido do usuário): **honesta por padrão + modo forçado do mestre** via janela `#controle`. Detalhe em `arquitetura.md`.
3. **Spike dos dados 3D antecipado para o Dia 1.** Era o maior risco técnico agendado para o Dia 4 — se a lib falhasse, sobrava 1 dia de folga. Agora falha cedo e barato.
4. **Regras que o plano ignorou e a mesa vai usar**: Ferido dá **-2 mecânico** (não é só badge), Surto dispara com **perda ≥5 de uma vez**, Trauma tem teste Vontade DT 12 com escolha na falha, e a ficha oficial rastreia **neuro-reguladores** (doses, Dependência, contador de Acessos — ferramenta de mestre valiosíssima: "gasta na pior hora possível").
5. **Tokens 3D não compartilham a cena dos dados.** A dice-box encapsula o próprio renderer; os tokens ganham uma cena Three.js leve e separada (mesma stack, cena própria). O plano prometia reaproveitamento que não existe.
6. **Export/Import JSON obrigatório.** localStorage é frágil demais para ser o único guardião da sessão. Backup entra no checklist do dia.
7. **Fallback 2D dos dados.** Se WebGL falhar no meio da sessão, rolagem via `crypto.getRandomValues` com animação CSS. O jogo nunca trava por causa do 3D.
8. **Microcopy in-world como requisito, não enfeite** — é a arma principal contra a cara de "gerado por IA". Vocabulário canônico em `arte.md`.
9. **A lib de dados mudou duas vezes.** Dia 1 trocou a abandonada `dice-box-threejs` pela Babylon `dice-box`; depois voltamos à `dice-box-threejs` porque só ela tem rolagem forçada nativa (`1d20@X`). Tipos escritos à mão. Detalhes em `arquitetura.md`.

---

## Concluído — Dias 1 a 4 + extras (detalhe completo no `git log`; decisões técnicas em `arquitetura.md`)

**Dia 1 — Fundação + spike ✅**: scaffold Vite/React/TS/Zustand, modelo de dados com export/import JSON, tabelas do jogo tipadas em `src/rules/data/`, spike de dados 3D validado (10 rolagens honestas). Node LTS via winget; Vite 8.1.5/Vitest 4.1.10 (0 vulns); git local sem remote.

**Dia 2 — Ficha completa ✅**: todos os campos de `ficha.md`; indicadores mecânicos (Ferido, linha da Sanidade só na transição descendo, Surto com perda ≥5, 3+ traumas — Surto e Trauma exibem os dois banners quando disparam juntos); multi-ficha; export/import na shell. Gate passou (ficha real só pela UI, sobreviveu a fechar/reabrir). **Lição: reiniciar o dev server a cada dia** — HMR longo corrompe o React ("Invalid hook call" sem bug de código).

**Dia 3 — Motor de regras + log ✅**: `rules/teste|sanidade|surto.ts` puros e testados; roladores Teste/Sanidade/Surto/Trauma + Rolagem Livre numa bandeja física única, com log automático. Gate passou (cena completa só por botões, log coerente).

**Fora de ordem — Rolagem forçada + troca de lib ✅** (decisão revertida a pedido do usuário): honesta por padrão + modo forçado via janela `#controle` (BroadcastChannel em `forcarRolagem.ts`; abre clicando no título "Estática — Mesa"). Lib Babylon → `dice-box-threejs` (única com `1d20@X` nativo — swap de face, indistinguível na tela). Regras duras: **um único `@` no fim da notação combinada** (o parser da lib quebra com mais de um); `consumirForcados` é exclusivo do `useDiceBox` (sorteio de trauma na ficha usa Math.random puro — já foi bug).

**Extras 18/07 ✅**: abas trocam por `display` sem desmontar (preserva bandeja/estados locais); log com filtros (personagem/tipo/busca); rolagem livre logada; ajuste manual de Acessos na ficha.

**Dia 4 — Dados 3D integrados ✅**: colorsets `rede`/`ruído` por rolagem (`colorsets.ts`; `updateConfig` só quando muda); fila de rolagens (roll() concorrente corrompe a lib — cadeado + fila, nenhum clique se perde); overlay d20 rápido em qualquer aba (`QuickRollOverlay`); atalhos `1–6`/`R`/`S` (ignorados ao digitar); fallback 2D automático sem WebGL (`rolarFallback2D`, respeita forçados); bandeja escala com o container (achado do Dia 3 morreu com a troca de lib). Gate: 21 rolagens seguidas, zero erros, log 1:1 com a tela. **Pendente do usuário: teste de screen share real no Discord.**

**Dia 5 — Mapa, tokens, NPCs, sessão ✅**: upload de mapa comprimido a 1600px/JPEG (`comprimirImagem.ts`); tokens arrastáveis via pointer events em coordenadas normalizadas (sobrevive a resize); cristal 3D por token (`tokens3d/TokenScene.tsx`, câmera ortográfica sincronizada com o layout DOM, jitter em Sanidade ≤25%) — canvas criado via `document.createElement` e removido inteiro no cleanup (não um `<canvas>` fixo do JSX), porque um canvas só aceita um contexto WebGL por vida inteira e StrictMode/remount real quebrariam nisso; NPCs (PV/Defesa/Agilidade/notas) + Iniciativa (`ordenarIniciativa` de `rules/teste.ts`, já existia e já era testada) numa tabela ordenada, log dedicado; aba Sessão com campos ao vivo. Gate passou (fluxo completo — NPC, rolar iniciativa, tokens no mapa, drag — em poucos cliques). **Achado**: erro de console "Canvas has an existing context" no load em dev já existia antes deste dia (dice-box-threejs + StrictMode) — confirmado via stash, não é regressão daqui.

**Dia 6 — Identidade visual total ✅**: sistema de ruído por tiers (`features/ruido/RuidoOverlay.tsx` + `styles/ruido.css`) — `data-ruido="0..3"` no `<html>` calculado por `calcularTierRuido` (novo, testado) a partir da Sanidade da ficha ativa; grain via SVG `feTurbulence` inline, scanlines, chroma aberration nos headers (tier 2+), glitch `steps()` + vinheta (tier 3), burst de 1,5s no Surto (`ultimoSurtoEm` no store, decai via CSS transition — zero rAF, só opacity/transform). Barras segmentadas com linha da metade (`BarraSegmentada.tsx`) pra PV e Sanidade, esta última também rotulada por tier ("nível de ruído: limpo/interferência/ruído/colapso"). Passada de microcopy: confirmações de apagar ficha/NPC e alerta de linha cruzada agora na voz do mundo (`arte.md`); indicador `● registrado` no header. Colorsets dos dados (rede/ruído) e devicePixelRatio (tokens3d) já vinham corretos de dias anteriores — conferido, não mexido. Gate: verificado visualmente nos 4 tiers via preview (bars, overlay e alerta reagem juntos); teste real de screen share fica pendente do usuário, como nos dias 4-5.

**Extras 19/07 ✅** (detalhe por commit no `git log`): dashboard da aba Sessão dividido em público/privado (`SessaoTab.tsx`); grid do mapa e rolagem rápida viram overlays minimizáveis (cantos opostos); `QuickRollOverlay` ganha modo perícia (teste completo, não só d20 solto); reflexo visual site-wide dos gauges de Ruído narrativo/Ameaça (`AlertaOverlay.tsx`, separado do ruído de Sanidade); `TokenOverlay` mostra painel compacto (perícias treinadas/veteranas, surto/trauma com tooltip de descrição, itens/armas/proteção/neuro-regulador); escolha de efeito do Surto passa de modal do mestre pra inline na própria ficha do personagem (`escolhaSurtoPendente`); Dificuldade da cena deixa de ser dropdown nos roladores (visível na tela compartilhada) e vira campo privado em "Sessão → cena atual", lido em silêncio via `useDtDaCena()`; conversor de câmbio R$↔P$; paleta de 10 cores + iniciais no token; rótulo "ruído sanidade" simplificado pra "sanidade". `schemaVersion` 3→6.

**Extras 20/07 ✅**: `CombatOverlay` reescrito com seleção de combatentes por checkbox + "selecionar todos" + opacidade 0.5 pra não selecionados + botão desabilitado se nenhum selecionado; `selecionadosIniciativa` movido pro store (`sessaoPrivada`, persistido via localStorage) — estado sobrevive a refresh e tabs; `NpcsTab` sincronizada com mesma lógica de seleção. Correção de tela preta: `condicoesCombate` vinha `undefined` do localStorage para dados com schema defasado — null guard no acesso (`MapaTab.tsx:220` com `(condicoesCombete ?? {})`), na action `alternarCondicaoCombate`, e na migração v7→v8 que agora reforça `condicoesCombete: {}` no `sessaoPublica`. `schemaVersion` 7→8.

**Redesign Roll20 (prompt-combate-roll20.md)**: `CombatOverlay` redesenhado com layout compacto em linha (colapsado/expandido) — linha única por combatente: `×` + posição + `▶` (se ativo) + nome + barra PV horizontal fina + `atual/max` + `🛡defesa` (cor `--real`, âmbar). Combatente ativo expande automático; clique expande/colapsa manualmente. Expandido mostra chips de condição + steppers PV/Defesa + ações de NPC. Barra de ação: `resetar` (sempre visível) → `rolar inic.` (só aparece se alguém marcado) → `iniciar`/`próximo`/`encerrar`. `+ adicionar combatente` colapsável. Divisórias `2px`. Drag-and-drop para reordenar turnos (`reordenarIniciativa` no store, ajusta `indiceAtualTurno` se turno atual movido). `TokenOverlay`: mostra `🛡 defesa` (PC e NPC) + ações de NPC; `×` de fechar com `color: var(--ruido)`. `calcularDefesa` importado de `rules/derivados`.

**Pós-redesign — Correções CombatOverlay**: largura do painel muda de `width: 380` fixo para `min(380px, calc(100% - 8px))` — encolhe quando o `mapa-area` é estreito, sem vazar. Clamp de arrasto corrigido: `maxX = rect.width - larguraPainel - 8` (antes ignorava a largura do painel, deixava a borda direita vazar). `minX` ajustável (`-30` a `8`) a gosto do usuário. Nome do combatente ganha `minWidth: 0` para truncar com ellipsis quando aperta. Botão ATK e × de fechar resetam panelPos para (8, 8).

**Tokens com posição consistente entre resoluções**: `TokenMapa.x/y` passa a ser fração relativa à **imagem** do mapa (não ao container). Helper `getImgRenderRect` calcula o retângulo renderizado da imagem (`object-fit: contain`) dentro de `.mapa-area`. Arrasto de token converte pixel → fração via retângulo da imagem; renderização do token DOM e do cristal 3D (TokenScene) converte fração → pixel via mesmo retângulo. Ambos recalculados em tempo real pelo `ResizeObserver` existente. Sem `object-fit: contain` não haveria letterbox — a fração relativa ao container daria no mesmo — mas `contain` garante que a imagem inteira seja visível em qualquer proporção de janela, o que é condição necessária para o multiplayer sincronizar posições corretamente.

**NPCs — Ações e duplicação**: tipo `NpcAcao` (id, nome, bonus, dano) — ações roláveis com atalho de dano nos chips de combate e no overlay do token. Botão `⊞ duplicar` na aba NPCs, com null guard (`acoes ?? []`) para NPCs de schema anterior. Migração v8→v9 adiciona `visivel`, `notasMestre`, `categoria`, `acoes: []`.

**Log de rolagens dedicado**: tipo `EntradaRoll` + `rollsLog` no store (persistido, exportado). Ações `registrarRoll`/`revelarRoll` (toggle privado→público). Aba Log exibe rolagens separadas do log narrativo, com filtro de visibilidade. Migração v9→v10.

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
| lib de dados 3D incompatível/abandonada | mitigado: `dice-box-threejs` validada em produção + fallback 2D automático implementado no Dia 4 |
| localStorage apagado antes da sessão | export JSON no checklist; autosave testado no Dia 2 |
| Screen share derrete performance | teste real no Discord nos gates dos Dias 4 e 6 |
| Ruído visual atrapalha leitura | tiers discretos; regra de legibilidade em `arte.md` |
| Escopo crescer no meio da semana | Fase 2 (cenas Marble/World Labs) só depois do Dia 7 — é upside, não meta |
| **A máquina da sessão é OUTRA** — algo depender de estado local da máquina de dev | postinstall recria assets 3D; caminhos absolutos fora do git; estado migra via export/import JSON; setup no README. **Migrar e testar na máquina final no Dia 6 ou 7, nunca no dia 25** |

## Migração para a máquina da sessão (fazer no Dia 6–7, não na véspera)

1. Instalar Node.js LTS na máquina final (`winget install OpenJS.NodeJS.LTS` no Windows)
2. `git clone` (ou copiar a pasta sem `node_modules`) + `npm install` — assets 3D vêm sozinhos via postinstall
3. Exportar o JSON da mesa na máquina de dev → importar na máquina final
4. Rodar o checklist abaixo **na máquina final**

## Checklist do dia da sessão (25/07) — executar na máquina final

- [ ] `npm run build` + `npx serve dist` funcionando **offline** (desligar wifi e testar)
- [ ] Export JSON de backup salvo fora do navegador
- [ ] Fichas dos jogadores conferidas contra as fichas de papel deles
- [ ] Mapa(s) do caso já importado(s), NPCs pré-cadastrados
- [ ] Discord: compartilhar a **janela** do navegador (não a tela), 1080p, modo "otimizar para vídeo" desligado
- [ ] Determinação de todos resetada para 1 ("abrir turno")
- [ ] d20 físico na mesa por garantia — *fé no rolador do navegador, mas o papel não esquece*
