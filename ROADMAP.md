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

**Nota de ambiente**: Node.js não estava instalado na máquina — instalado via `winget install OpenJS.NodeJS.LTS` (v24.18.0) com autorização do usuário. `npm audit` inicial acusou 5 vulnerabilidades (todas do dev-server, Vite/Vitest/esbuild) — corrigido subindo para Vite 8.1.5 + Vitest 4.1.10 (0 vulnerabilidades). Repositório git local inicializado (`git init`), commit inicial feito sob pedido explícito do usuário — sem remote configurado.

## Dia 2 — Ficha completa ✅ concluído

- [x] Todos os campos de `ficha.md`: identidade (com preset de antecedente — confirma antes de sobrescrever kit/perícias), vínculos (máx. 3), atributos, derivados auto (PV/Sanidade/Defesa/Alerta com dial de letalidade via `config.basePV`), 15 perícias com toggles —/T/V agrupadas por atributo, traumas/cicatrizes (manual ou sorteio d20 na tabela oficial), equipamento, armas (livre ou preset do arsenal com dano/alcance/nota auto-preenchidos), reguladores (doses, Acessos por telemetria, Dependência auto-detectada, flag de anestesia), dinheiro R$/P$ com botões rápidos (±1/10/100), anotações.
- [x] Indicadores mecânicos, todos testados manualmente no navegador com valores reais: **Ferido** (badge ao cruzar metade do PV), **linha da Sanidade** (alerta "marque um Trauma" só na transição descendo, não reausa em toda edição), **Surto** (perda ≥5 numa única alteração — descoberto e corrigido um bug onde Surto escondia o alerta de Trauma quando os dois disparavam juntos; agora mostram os dois banners), **3+ Traumas ativos** ("à beira de se perder").
- [x] Multi-ficha (lista lateral com cor + nome, adicionar/remover com confirmação, ficha ativa persistida).
- [x] Export/Import JSON funcionando no shell de abas (botões "imprimir tudo" / "importar").
- [x] Regras novas cobertas por teste (`derivados.test.ts`, `reguladores.test.ts` — 18 testes).
- **Gate passou**: ficha real criada e preenchida (identidade, antecedente, atributos, perícias, trauma, arma, dose de regulador, dinheiro) só pela UI: fechado e reaberto o navegador — tudo sobreviveu no localStorage.

**Achado**: uma sessão de dev server muito longa (rodando desde o Dia 1, muitos ciclos de HMR) acumulou estado inconsistente e quebrou com "Invalid hook call". Não era bug de código — reiniciar o servidor com `node_modules/.vite` limpo resolveu. Lição para os próximos dias: reiniciar o dev server a cada dia do roadmap, não deixar rodando indefinidamente.

## Dia 3 — Motor de regras + log (sem 3D de produção ainda) ✅ concluído

- [x] `rules/teste.ts`: teste padrão (d20+atrib+perícia vs DT, margem 10+, 20/1 natural sempre sucede/falha, Ferido -2 só em Vigor/Agilidade), iniciativa (d20+Agilidade, empate por maior Agilidade), dano de ataque (corpo a corpo soma Vigor, margem 10+ = dano máximo do dado).
- [x] `rules/sanidade.ts`: `calcularPerdaSanidade(valorRolado, sucesso)` — metade arredondada pra baixo no sucesso.
- [x] `rules/surto.ts`: `resolverSurto(d20A, d20B)` — mapeia os dois d20 pra tabela, detecta "o destino insiste" no empate.
- [x] **Quatro roladores integrados de ponta a ponta na aba "Dados & Regras"**, todos compartilhando uma única bandeja física (`DadosTab.tsx` + `useDiceBox` hook do Dia 3.5):
  - `RoladorTeste.tsx` — teste padrão (d20+atributo+perícia vs DT)
  - `RoladorSanidade.tsx` — rola Vontade+dado de perda combinados numa só jogada física (`[{sides:20},{sides:dado}]`), aplica sucesso=metade/falha=tudo, chama `ajustarSanidadeAtual` (que já detecta cruzamento de linha e Surto, do Dia 2)
  - `RoladorSurto.tsx` — 2d20 físicos, mostra as duas entradas da tabela lado a lado com botão de escolha; trava a escolha após clicar; detecta empate automaticamente
  - `RoladorTrauma.tsx` — lista só os traumas ativos (exclui os que já viraram Cicatriz) da ficha selecionada, rola Vontade vs DT12 fixo; na falha, oferece as duas respostas da regra (perder 1d4 Sanidade — rolado sob demanda — ou interpretar por +1 Determinação)
- [x] Log da sessão cobrindo os quatro caminhos, testado com uma sequência real: teste padrão → Sanidade (falha, perde tudo) → Surto (escolhido) → Trauma (falha → interpretou, +1 Determinação) — todas as linhas batendo matematicamente no log.
- [x] 36 testes automatizados no total (`teste.test.ts`, `sanidade.test.ts`, `surto.test.ts` + os de dias anteriores).
- **Gate passou**: simulei uma cena completa só clicando botões na aba de Dados — teste, dano por Sanidade com Surto/linha detectados, escolha de Surto, gatilho de Trauma com as duas respostas possíveis — tudo com dados físicos reais e log coerente.

## Fora de ordem — Rolagem forçada + troca de biblioteca de dados ✅ (a pedido do usuário)

Decisão **revertida** a pedido do usuário: rolagem deixa de ser "sempre honesta" e passa a **honesta por padrão + modo forçado** controlado por uma janela secreta, fora da tela compartilhada.

- **Troca de lib**: `@3d-dice/dice-box` (Babylon) → `@3d-dice/dice-box-threejs`. Motivo: só a versão threejs suporta resultado forçado nativo (`1d20@X`, faz swap da face — indistinguível na tela). O Babylon não expõe isso sem forkar (física em worker offscreen + cena privada). Trade-off aceito: lib menos mantida. Three vem bundlada nela → sem conflito com o Three 0.169 dos tokens.
- **Adapter** (`useDiceBox.ts`) traduz o resultado da nova lib de volta pro shape que os 4 roladores já usavam → **zero reescrita da UI dos roladores**. Colorset âmbar/ciano agora é `theme_customColorset` inline (o problema de recolorir textura do Babylon sumiu; `assets-src/dice-theme-estatica/` removido).
- **Janela de controle** (`#controle`, `ControlPanel.tsx`) + **BroadcastChannel** (`forcarRolagem.ts`): o mestre abre uma 2ª janela (botão "controle"), enfileira o valor bruto; a próxima rolagem cai nele (ou persiste, se marcar). Sync bidirecional, `umaVez` por padrão.
- **Validado com 2 janelas reais**: força de 1 dado (teste → 1 natural/complicação), de 2 dados (surto 2d20 → 10 Fúria / 20 Sintonia), reversão ao honesto após consumir, zero erros. Detalhes em `arquitetura.md`.

**Achado do Dia 3 (bandeja de dados) — resolvido de graça pela troca de lib**: o problema original era que o tamanho visual da bandeja não batia com a área real de física, diagnosticado contra o `@3d-dice/dice-box` (Babylon). A `dice-box-threejs` calcula as paredes da física a partir de `this.display.containerWidth/containerHeight` (`makeWorldBox()`, lido no código-fonte) — ou seja, a área de jogo já escala com o tamanho real do container. Confirmado visualmente no Dia 4: rolagens de Surto (2d20) e Teste (1d20) usam boa parte da largura da bandeja, dados caindo em pontos variados, não presos num canto pequeno. Nenhum ajuste de CSS/escala foi necessário.

## Ajuste de regressão de sessão — preservação de estado entre abas (18/07/2026)

- [x] Reproduzido o bug de regressão: trocar de "Dados & Regras" para "Personagens" e voltar fazia o componente desmontar, zerando `useState` dos roladores e o container da mesa física.
- [x] Correção aplicada na shell principal: o conteúdo de cada aba continua montado e só muda a visibilidade com `display`, em vez de remover o componente do JSX.
- [x] Efeito esperado: a seleção de Surto/Trauma, o estado de rolagem e a bandeja de dados permanecem quando o mestre navega entre abas.
- [x] Verificação: `npm run build` finalizou com sucesso após o ajuste.

## Refinamento de log e telemetria — sessão de 18/07/2026

- [x] A aba de log agora possui filtros por personagem, tipo de evento e busca por texto, permitindo uma leitura limpa em sessões longas.
- [x] A rolagem livre passou a ser registrada no log da sessão, com resultado completo e rastreável.
- [x] O contador de acessos por personagem foi tornado mais explícito na ficha de reguladores, com ajuste manual direto para o mestre.
- [x] Verificação: `npm run build` continuou passando após os ajustes de registro e filtro.

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
