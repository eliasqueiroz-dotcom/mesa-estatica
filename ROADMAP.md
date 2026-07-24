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

**Tokens com posição consistente entre resoluções**: `TokenMapa.x/y` passa a ser fração relativa à **imagem** do mapa (não ao container). Helper `getImgRenderRect` calcula o retângulo renderizado da imagem (`object-fit: contain`) dentro de `.mapa-area`. Arrasto de token converte pixel → fração via retângulo da imagem; renderização do token DOM e do cristal 3D (TokenScene) converte fração → pixel via mesmo retângulo. Ambos recalculados em tempo real pelo `ResizeObserver` existente.

**Rebalanceamento NPCs & Iniciativa**: grid da aba muda de `minmax(360px, 1fr) minmax(280px, 380px)` para `3fr 2fr` — mais espaço para a lista de iniciativa. Cards de NPC passam de lista vertical para grid responsivo de 2 colunas (`repeat(auto-fill, minmax(260px, 1fr))`). Grid de edição de NPC (`npc-card__grid`) muda de `repeat(4, 1fr)` para `repeat(2, 1fr)` para caber nos cards mais estreitos. Espaçamento vertical de combatentes e checkboxes na iniciativa aumentado.

**NPCs — Ações e duplicação**: tipo `NpcAcao` (id, nome, bonus, dano) — ações roláveis com atalho de dano nos chips de combate e no overlay do token. Botão `⊞ duplicar` na aba NPCs, com null guard (`acoes ?? []`) para NPCs de schema anterior. Migração v8→v9 adiciona `visivel`, `notasMestre`, `categoria`, `acoes: []`.

**Log de rolagens dedicado**: tipo `EntradaRoll` + `rollsLog` no store (persistido, exportado). Ações `registrarRoll`/`revelarRoll` (toggle privado→público). Aba Log exibe rolagens separadas do log narrativo, com filtro de visibilidade. Migração v9→v10.

**Refatoração iniciativa 21/07 ✅**: lógica de combate/iniciativa extraída de `CombatOverlay.tsx` e `NpcsTab.tsx` para um hook compartilhado `src/hooks/useIniciativa.ts` + componente `src/features/iniciativa/IniciativaPanel.tsx`. Elimina duplicação de PV/Defesa/seleção/drag-and-drop/ações de NPC entre as duas abas. **ControlPanel** (`#controle`) agora também aceita NPCs como alvo de rolagem forçada (antes só PCs). DT da cena não aceita mais valor zero (`Math.max(1, ...)`). Fila de forçados usa `assinar`/`filaAtual` do módulo em vez de Zustand como fonte primária, com merge na sincronização BroadcastChannel (`fila = [...msg.fila, ...fila]`). `TokenOverlay` adiciona label `nível {n}` nos checkboxes de Determinação.

## Multiplayer — Fases A–D (23/07)

Implementação de `mesa-estatica-multiplayer-completo.md` (Supabase, RLS real, Edge Functions), decisão do usuário de adiantar pra antes do dia 25 apesar do aviso original do doc. Cada fase numa branch própria, testada contra o Supabase real (não mock) antes de ir pra `main`.

- **Fase A ✅ em produção**: sincronização de posição de token via Realtime. `src/multiplayer/tokensSync.ts` + `tokensDiff.ts` (testado). RLS aberto nesta fase — aceitável só pra posição, não pra dado sensível.
- **Fase B ✅ em produção**: fichas com dono real. Anonymous Auth + Edge Functions `vincular-jogador`/`vincular-mestre` + tabela `mestres`/`is_gm()`; `characters_publico`/`characters_privado` (Parte IV do doc — ficha dividida em superfície pública e resto privado). Validado: mestre vê/edita tudo, jogador vinculado só a própria ficha, jogador não cria ficha nem lê/escreve a de outro — bloqueado pelo RLS, não só escondido na UI.
- **Fase C ✅ construída, não ligada**: Edge Function `resolver-rolagem` — honesta (`crypto`, não `Math.random`) e forçada via `forced_queue`, decisão sempre no servidor. Infra pronta e testada isoladamente (notação `1d20@N` confirmada); `useDiceBox.ts` continua no caminho local de sempre.
- **Fase D ✅ construída, atrás de flag desligada**: `resolverRolagemRemota` religado em `montarNotacao`/`rolarFallback2D`/`ControlPanel` (via `useFilaForcada.ts`), atrás de `VITE_FASE_D_ROLAGEM_REMOTA` (off por padrão — comportamento local não muda). Validado ponta a ponta contra o Supabase real e confirmado visualmente (dado caindo na bandeja 3D com a flag ligada). Falta teste com 2 aparelhos físicos reais antes de ativar em produção.

Doc `mesa-estatica-multiplayer-completo.md` ganhou **Parte IV** (separação de visualização mestre/jogador — bundle separado, sigilo em 3 camadas) e **Parte V** (operacional — como colocar no ar: config/segredos, seed, links, Storage, migrações, Realtime, fallback offline).

**Extras da mesma sessão**: rolagem de NPC (chips de ação em `TokenOverlay`/`IniciativaPanel`/`NpcsTab`) agora sempre privada por padrão — só o `rollsLog` tem controle de privacidade de verdade, o log narrativo nunca teve. `QuickRollOverlay` no modo NPC não exige mais selecionar um NPC pra rolar (mesma flexibilidade que `RolagemLivre` já tinha). Corrigidos 6 bugs em `store.test.ts` que quebravam `npm run build` — alguns eram crash de verdade em runtime (`converterDinheiro` sem criar ficha antes), não só erro de tipo.

### Parte IV — separação de visualização (em andamento, sem pressa pro dia 25)

Branch `multiplayer/parte-iv-view-jogador`, sem prazo — decisão do usuário de construir com calma em vez de forçar caber antes da sessão. Ordem do plano: extrair componentes de leitura (`*View`) primeiro, único passo adiantável sem Supabase/bundle separado; cada um verificado ao vivo (montagem temporária numa aba existente, revertida antes do commit) sem tocar no app do mestre.

- **`FichaPublicaView` ✅**: superfície de mesa de um PC alheio (nome, cor, PV, ferido, surto) a partir do tipo `FichaPublica` já existente (Fase B).
- **`NpcPublicaView` ✅**: superfície de mesa de um NPC revelado (nome, cor, PV, Defesa, Agilidade, categoria, notas, lista de ações só-exibição). Nunca `notasMestre`; recusa renderizar se `visivel` for falso, mesmo que quem chama esqueça de filtrar.
- **`SessaoPublicaView` ✅**: situação da sessão + parte pública da cena atual (atmosfera, "o que os jogadores veem") + mini log. Nunca `sessaoPrivada` (gauges, lembretes, "o que realmente acontece", próximo evento, dificuldade da cena) — nem chega como prop.
- **Split de bundle Vite ✅**: `index.html`→`src/entries/mestre.tsx` (app completo) e `jogador.html`→`src/entries/jogador.tsx`→`PlayerApp` (só as `*View`, abas Sessão/Personagens/NPCs). `vite.config.ts` com `build.rollupOptions.input` nas duas entradas. Validado por build real: chunk do jogador (7,5kB) sem nenhuma string exclusiva de mestre (`#controle`, `forcarRolagem`, `forced_queue`, `resolver-rolagem`) presentes no chunk do mestre; confirmado ao vivo nos dois bundles. `PlayerApp` ainda lê do store local (mesma origem do app de mestre) — vira Realtime filtrado por RLS na próxima fase.
- **Geração de links do jogador ✅**: o `owner_token` já era gerado na criação da ficha (`fichasSync.ts`, Fase B) mas nunca ficava acessível na UI. Ícones 🔗/↻ por ficha em `FichasTab` (`LinkJogadorBotao.tsx` + `multiplayer/links.ts`) buscam o token em `characters_privado`, montam `<base>/jogador.html?t=<token>` e copiam pro clipboard; ↻ regenera o token (mitigação de link vazado, doc §13) sem afetar as outras fichas. GM-only, fora do bundle do jogador (chunk seguiu em 7,45kB). Caminho feliz completo (Supabase real + GM vinculado) não testado nesta sessão — exige o `gm_token` do projeto; o caminho de erro (ficha ainda não sincronizada) foi validado e degrada sem travar.

- **Hidratação do `PlayerApp` via Realtime ✅**: duas tabelas novas — migrações `0003_npcs.sql` (`npcs_publico`/`npcs_privado`, mesmo split de `characters_*`, `visivel` como RLS de linha) e `0004_sessao_publica.sql` (linha singleton `id='sessao'` — esta implementação não tem `session_id`). `npcsSync.ts`/`sessaoPublicaSync.ts` (GM, push+pull) ligados em `App.tsx`; `hidratacaoJogador.ts` (jogador, só leitura) alimenta o `PlayerApp` — `sessaoPublica` vai pro `useStore` compartilhado (os componentes já leem de lá), `fichas`/`npcs` ficam em estado local do componente. **Testado ponta a ponta contra o Supabase real**: migrações aplicadas (`supabase migration repair` + `db push` — 0001/0002 já existiam fora do rastreio da CLI, precisou reparar o histórico antes), dados semeados via `supabase db query --linked`, `jogador.html` local apontando pro projeto real mostrou sessão/NPC corretos, `notasMestre` nunca apareceu, e uma alteração de PV via SQL propagou pro navegador **sem reload** (Realtime de verdade, não só fetch inicial). Dados de teste removidos depois.
- **Própria ficha do jogador editável ✅** (`minhaFicha.ts`): resolve "qual é a minha ficha" via `characters_privado` sem filtro de id — a RLS já restringe pra 1 linha. Popula o `useStore` com essa ficha e liga `iniciarSyncFichas`, o MESMO módulo do `GmApp` — reusa `FichaEditor` completo sem modificação, incluindo actions especializadas que algumas sections chamam direto do store (não via prop `onChange`). Achados/correções desta sessão: (1) bug real de corrida StrictMode em dev — `useMinhaFicha` fazia trabalho async antes de ligar `iniciarSyncFichas` sem checar `cancelado` bem antes dessa chamada, deixando duas assinaturas ativas ao mesmo tempo (uma tentava INSERT numa linha que a outra já tinha criado → RLS 42501), corrigido; (2) `store.ts` ganhou `storage` condicional no `persist` (localStorage real só no `GmApp`, no-op no bundle do jogador) — os dois bundles rodando na mesma origem compartilhavam a mesma chave `estatica-mesa`, contaminando o `PlayerApp` com estado do `GmApp`. Testado ponta a ponta: GM criou ficha pela UI real, jogador abriu o link real numa sessão anônima genuinamente separada, editou, valor confirmado no banco por query direta.

- **Rolagem do jogador via `resolver-rolagem` ✅** (Fase 6): trouxe pra esta branch as Fases C/D via merge de `multiplayer/fase-d-controle-remoto` (nunca tinham sido mescladas a `main`, apesar do ROADMAP já descrever como prontas) — migração da Fase C renumerada 0003→0005 (colidia com `0003_npcs.sql` desta branch), aplicada no Supabase real. `resolverRolagemJogador` (nova, em `rolagemRemota.ts`) chama `resolver-rolagem` sempre, sem o gate `VITE_FASE_D_ROLAGEM_REMOTA` (o jogador não tem `#controle`, então não existe "caminho local" pra rolagem forçada fazer sentido); `montarNotacao`/`rolarFallback2D`/`useDiceBox` ganharam um parâmetro `resolverRemoto` injetável, default preserva 100% o comportamento do mestre. `RoladorTesteJogador` + `DadosTabJogador` (aba nova no `PlayerApp`): só a própria ficha, sem sucesso/falha (a DT mora em `sessaoPrivada`, nunca chega no bundle do jogador) — só d20+modificador=total, mestre narra. Separado `filaRemota.ts` (GM-only) de `rolagemRemota.ts` pra tirar o nome da Edge Function `gerenciar-fila-forcada` do bundle do jogador (camada "código" do doc). **Testado ponta a ponta contra o Supabase real**: GM criou ficha pela UI, jogador rolou honesto (bateu com `rolls_log`); simulei o mestre forçando o próximo valor (insert em `forced_queue`, equivalente ao `#controle`) — o próximo roll do jogador saiu exatamente nesse valor, sem nenhum indício de que foi forçado, confirmando o mecanismo central do doc (§5).

Faltam: corte do `#controle`/forçado pro transporte novo (Fase D ainda atrás da flag desligada no lado do mestre), tela GM-only pra colar o `gm_token` (hoje só a Edge Function `vincular-mestre` existe, sem UI).

## Dia 7 — Playtest e folga

- [ ] Simular uma sessão inteira sozinho (investigação → combate → surto → downtime), corrigindo o que atritar.
- [ ] README com o comando de subir offline (`npm run preview`) e o checklist do dia.
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

- [ ] `npm run build` + `npm run preview` funcionando **offline** (desligar wifi e testar)
- [ ] Export JSON de backup salvo fora do navegador
- [ ] Fichas dos jogadores conferidas contra as fichas de papel deles
- [ ] Mapa(s) do caso já importado(s), NPCs pré-cadastrados
- [ ] Discord: compartilhar a **janela** do navegador (não a tela), 1080p, modo "otimizar para vídeo" desligado
- [ ] Determinação de todos resetada para 1 ("abrir turno")
- [ ] d20 físico na mesa por garantia — *fé no rolador do navegador, mas o papel não esquece*
