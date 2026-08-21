# ROADMAP — Mesa de Estática

> Painel de mestre: ficha viva, motor de regras, dados 3D, mapa com tokens, app do jogador e sync via Supabase. Publicado no Cloudflare Pages.
> Próxima sessão de jogo: **29/08/2026**. Docs: [regras](.claude/docs/regras.md) · [ficha](.claude/docs/ficha.md) · [arte](.claude/docs/arte.md) · [arquitetura](.claude/docs/arquitetura.md) · [multiplayer](mesa-estatica-multiplayer-completo.md) · [mídia/R2](.claude/docs/storage-r2.md) · [mcp servers](.claude/docs/mcp-servers.md).
>
> **Histórico detalhado fica no `git log`, não aqui.** Este arquivo guarda: estado atual, invariantes que não podem ser re-quebradas, e o que vem a seguir.

## Estado atual

Tudo abaixo está implementado, testado e em produção salvo indicação em contrário.

- **Ficha e regras**: ficha completa (`ficha.md`), motor em `src/rules/` puro e testado, indicadores mecânicos (Ferido, linha da Sanidade, Surto com perda ≥5, traumas), neuro-reguladores, dinheiro R$/P$ com câmbio, Kit de Investigação, export `.docx` + import via IA (sobrescreve por nome; via `.docx` automático por Edge Function/Groq+OpenRouter fallback — `.claude/docs/storage-r2.md` Parte 4 — ou manual copiar/colar).
- **Dados**: 3D com colorsets por tipo de rolagem, fila de rolagens, fallback 2D sem WebGL, rolagem rápida em qualquer aba. Honesta por padrão; forçada só pela janela `#controle`.
- **Mapa/combate**: upload comprimido, tokens arrastáveis com cristal 3D, grade configurável, régua de medição, AoE (círculo/quadrado), `CombatOverlay` com iniciativa, condições, glossário e drag-and-drop.
- **Sessão**: dashboard público/privado, gauges de Ruído Narrativo/Ameaça com reflexo visual site-wide, ruído de Sanidade por tiers, log narrativo + `rollsLog` separados com visibilidade, aba Pistas (GM-only), jukebox sincronizado.
- **Multiplayer (Supabase)**: Fases A e B em produção (tokens; fichas com dono real via Anonymous Auth + RLS). App do jogador (`jogador.html`) com paridade: ficha própria editável, roladores, mapa, combate read-only, log, mídia. Além das fases A-D originais, já em produção: FoW, AoE, régua, ping, soundpad, rolagem ao vivo transmitida — ver `mesa-estatica-multiplayer-completo.md` §11 (parcialmente desatualizado quanto a isso, tratar como histórico de design, não checklist do estado atual).
- **Fase C** (Edge Function `resolver-rolagem`) construída mas **não ligada** no caminho do mestre. **Fase D** atrás da flag `VITE_FASE_D_ROLAGEM_REMOTA` (**off por padrão**) — falta teste com 2 aparelhos físicos antes de ativar.
- **Mídia (Cloudflare R2 + Freesound)**: áudio do soundpad/jukebox migrado do Supabase Storage pro R2 (egress zero pra leitura), trava de cota de 8GB, limite de 100MB por arquivo, busca de efeito sonoro direto do Freesound no soundpad. Imagem de mapa/NPC/ficha continua no Supabase Storage (paga egress) — decisão consciente, ver `.claude/docs/storage-r2.md`.
- **Site**: publicado no Cloudflare Pages (migrado do GitHub Pages) — `base: '/'` no Vite, CI continua fazendo lint+test+build antes do deploy.

## Invariantes — aprendidas na marra, não re-quebrar

Cada uma custou um bug real em produção ou ao vivo numa sessão.

- **Exclusão nunca por diff.** Sync infere criação/edição por diff, mas remoção só propaga se a UI marcou de propósito (`multiplayer/remocaoExplicita.ts`). O `GM_TOKEN` é compartilhado — uma aba com lista desatualizada apagava fichas/NPCs/tokens de todo mundo.
- **Flag de "aplicando remoto" é contador, não boolean.** Duas tabelas disparam dois eventos Realtime pro mesmo push; com boolean, o primeiro a terminar zera a flag e o segundo vaza como edição local → loop exponencial de requests.
- **Coordenadas do mapa são % da IMAGEM renderizada**, nunca do container (`getImgRenderRect`/`retanguloGradeEmPx` em `mapaUtils.ts`) — edição E renderização. Container varia por dispositivo; misturar as duas bases desalinha mestre e jogador.
- **Notação de dado forçado aceita um único `@` no fim** — o parser da lib quebra com mais de um.
- **Consumo da fila forçada é destrutivo e casa por alvo + tipo.** Enquanto a única chave era o personagem, qualquer consumidor novo roubava entradas dos outros (um forçado guardado pro d20 de um teste sumia se um sorteio de trauma rodasse antes) — foi o que manteve a fila restrita ao `useDiceBox` por muito tempo. Com o eixo de `tipo` (06/08) dá pra ligar os outros pontos; sem ele, não. O sorteio de trauma segue de fora, por decisão.
- **`forcarRolagem.ts` não pode entrar no bundle do jogador** (abre `BroadcastChannel` no top-level). Quem rola fora da bandeja usa a ponte neutra `dice/registroForcados.ts`, que só o entry do mestre popula — nunca import direto.
- **Visibilidade de rolagem precisa existir no banco.** `registrarLog` (texto livre) e `registrarRoll` são canais paralelos: filtro client-side não basta, a coluna + RLS têm que existir, senão o eco do Realtime devolve a entrada sem visibilidade e vaza.
- **Bundle do jogador não persiste em localStorage** (storage condicional no `persist`) — os dois bundles rodam na mesma origin e compartilhariam a chave `estatica-mesa`.
- **Fallback de array em selector do Zustand precisa ser constante fora do componente** (`EMPTY_CONDICOES`) — `?? []` inline cria array novo a cada render e quebra com "getSnapshot should be cached".
- **Canvas WebGL é criado via `document.createElement` e destruído no cleanup**, nunca um `<canvas>` fixo do JSX — um canvas aceita um contexto WebGL por vida inteira, e StrictMode/remount quebram nisso.
- **Token em arrasto ignora eco remoto** (`tokensEmArrasto` em `tokensSync.ts`), senão a posição pula durante o arrasto.
- **HMR longo corrompe o React**: "Invalid hook call" numa aba antiga depois de editar hook não é bug — abrir aba nova.

## Próximos passos — confiabilidade pós-publicação

O app nasceu local; agora tem URL pública. Auditoria (tratamento de erro, RLS, build/deploy) levantou os gaps abaixo.

### Fase 0 — evitar perda de dados ao vivo (concluída em 04/08)

1. ~~**Try/catch em `criarStorageComDebounce`**~~ — `setItem/getItem/removeItem` agora engolem `QuotaExceededError`/localStorage indisponível em vez de propagar não capturado; reporta em `lib/statusMesa.ts`.
2. ~~**Indicador visual de status**~~ — novo `lib/statusMesa.ts` (store efêmero, fora do `persist`) + `StatusIndicador.tsx` no header do mestre: "● registrado"/"⚠ não salvou local" e "● sync ok"/"⚠ sync com erro"/"— local". Cada um dos 11 módulos de sync do lado do mestre reporta pelo callback de status do `.subscribe()` do Realtime (`assinarStatusCanal`/`desconectarCanal`) — não foi mexido nos ~25 pontos individuais de `.catch(console.error)` dos pushes, o canal já é o sinal agregado que importa. Lado do jogador não tem o indicador de propósito (os canais de `hidratacaoJogador.ts` não foram instrumentados — mostrar status ali seria enganoso).
3. ~~**Backup — lembrete, não automático**~~ — download automático via script se choca com o bloqueio de "múltiplos downloads" do navegador depois do primeiro; virou lembrete visual no botão "exportar" (some ao clicar) a cada 15min, exige o clique real que o navegador sempre permite.

### Fase 1 — evitar a tela travar (concluída em 04/08)

- ~~**Error Boundary React**~~ (`app/ErrorBoundary.tsx`) — envolve `<App>`/`<PlayerApp>` nos dois entries. Fallback oferece "baixar backup agora" (chama `exportarJSON` direto do `useStore.getState()`, imperativo — não depende de nenhum componente quebrado) e "recarregar". Testado ao vivo: corrompi `fichas[0].traumas` pra string no localStorage — sem o boundary a tela toda travava; com ele, só aparece o fallback, dado intacto.
- ~~**Handler global `window.onerror`/`unhandledrejection`**~~ (`lib/globalErrorHandler.ts`) — não tenta recuperar nada, só acende `⚠ erro inesperado` no `StatusIndicador` (clique dispensa) via `statusMesa.ts`.
- ~~**Validação de shape em `importarJSON`**~~ (`state/validarImportacao.ts`) — além da presença das 6 chaves (já existia), agora confere o TIPO de campos aninhados (`fichas[].traumas` deveria ser lista, `.atributos` deveria ser objeto, etc.) antes de tocar no estado. Reproduzi o cenário exato do bug (traumas como string): sem a validação, quebra no render de `TraumasSection` sem contexto nenhum; com ela, `importarJSON` lança `formato inválido: "fichas[0].traumas" deveria ser uma lista` antes de mudar qualquer coisa.

### Fase 2 — segurança pós-publicação (concluída em 05/08)

- ~~**Rate limit em `vincular-mestre`**~~ — tabela `mestre_tentativas` (migração 0022), 5 tentativas erradas por identidade anônima e bloqueia 15min. Testado ao vivo contra o Supabase real: 5x token errado → 403, 6ª → 429.
- ~~**RLS de `tokens` fechada de verdade**~~ (migração 0021) — item mais sério: `using (true)` desde a Fase A deixava qualquer um com a chave anon reescrever/apagar token de qualquer personagem. Agora insert/delete só `is_gm()`, update dono-ou-mestre. `mídia` (bucket) ficou aberta de propósito — risco baixo, refactor maior; decisão consciente, não esquecimento.
- ~~**Aviso visível sem Supabase em produção**~~ — `AvisoSupabaseAusente.tsx`, banner vermelho só quando `import.meta.env.PROD && !supabase` (nunca aparece em dev local sem `.env`, que é uso válido). Testado com build real sem as env vars.
- ~~**Auditoria de reuso de token em `vincular-jogador`**~~ — tabela `vinculo_jogador_log` (migração 0023) registra auth_uid anterior → novo a cada vínculo bem-sucedido, sem bloquear (revincular é comportamento válido). Só leitura do mestre; sem UI ainda, é consulta direta no banco.

### Fase 3 — nice to have (concluída em 21/08)

- ~~**ESLint no CI**~~ — `eslint.config.js` novo (flat config, ESLint 10 + typescript-eslint). Só `src/**` (mesmo escopo do `tsconfig.json`); `react-hooks` restrito às regras clássicas (`rules-of-hooks`/`exhaustive-deps`) — o `recommended` do plugin v7 vem com o pacote de regras do React Compiler (purity, refs, set-state-in-effect) que acusa padrões intencionais já usados no projeto (ex.: `ref.current = valor` direto no render em `TokenScene.tsx`) como erro. `no-unused-vars` desligado (o `tsc --strict` já cobre). Gate novo em `deploy.yml`, antes do build. 0 erros, 18 avisos de `react-refresh` (HMR only, não bloqueiam).
- ~~**`404.html`/`robots.txt`**~~ — página 404 com a identidade visual do app (`public/404.html`, self-contained, sem CDN) + `robots.txt` com `Disallow: /`. Também `<meta name="robots" content="noindex, nofollow">` em `index.html`/`jogador.html` — é o que realmente vale pra um site num subpath (`/mesa-estatica/robots.txt` não é o local padrão que crawlers verificam; a spec do protocolo só olha a raiz do domínio).
- ~~**Detecção de offline + fila de pendências**~~ — `multiplayer/filaPendencias.ts` (registrar/resolver pendência por módulo+chave, retry automático no evento `online` e na reconexão de canal, persistência só de metadados) + `online` em `lib/statusMesa.ts` + spans novos no `StatusIndicador`. Todos os 15 módulos de sync com tabela/broadcast persistível cobertos (21/08): diff por id (`tokensSync`, `fichasSync`, `npcsSync`, `midiaFaixasSync`, `soundpadSync` — por slot), singleton (`fowSync`, `mapaPublicoSync`, `midiaEstadoSync`, `sessaoPublicaSync`), broadcast puro só no envio garantido de fim de gesto (`reguasSync`, `aoeSync` — `canal.send` não devolve erro observável, gatilho é `online===false` no momento do envio), array inteiro sem re-leitura da store no retry (`iniciativaSync` — motivo: `iniciativaAnterior` já avança de forma otimista antes do resultado do push, reler a store no retry veria um diff vazio; boot faz best-effort upsert-only, sem recuperar delete perdido através de reload) e insert-only por id (`logRollsSync` — log/rollsLog, incluindo `visibilidade` de rolls). `pingSync`/`rolagemAoVivoSync` ficam de fora de propósito (dado descartável, atrasar por reconexão é ruído). `npm test` (584), `npm run lint`, `tsc --noEmit` e `npm run build` verdes. **Não testado**: wifi real desligado com dois clientes de verdade — só simulação de evento `online`/`offline` no DevTools.

### Ideias sem prioridade

Recap automático de sessão a partir do log · indicador sutil de Sanidade no jogador.

## Próximos passos — mesa ao vivo

Quatro frentes levantadas em 06/08, depois da caça a bugs. O levantamento técnico de cada uma já foi feito; o que está aqui é o desenho e as pegadinhas descobertas, não código.

### 1. ~~Dado rolando visível para todos~~ — concluído em 08/08

Rolagem de jogador transmite pro resto da mesa via broadcast (`dados`, migração 0030) — bandeja própria sempre montada no header (`RolagemAoVivoPlayer.tsx`), cor/nome de quem rolou, aba "Dados" acende se quem vê estiver em outra aba. Rolagem do mestre nunca é transmitida (sigilo por bundle, não checagem em runtime).

**Confirmado em 21/08**: migração 0030 já estava aplicada em produção (`supabase migration list --linked`, `local` = `remote` até 0033). Roundtrip real entre dois clientes não foi testado ao vivo, mas segue o mesmo padrão de policy de 0025 (régua/AoE) e 0029 (ping), ambas já validadas em produção.

### 2. Ambiente de desenvolvimento isolado da mesa oficial — **só depois de 29/08**

Testar feature nova não pode encostar na sessão real, e desenvolver não deveria expor o conteúdo do RPG.

**Adiado de propósito**: hoje não existe mesa oficial pra proteger — o banco de produção só passa a ter dado real que importa quando a ferramenta entrar em uso de verdade, na sessão de 29/08. Montar o segundo projeto antes disso é cerimônia sem ganho. Retomar logo depois da sessão, antes da primeira feature que mexa em sync.

- **"Dois tokens" não resolve** — foi a primeira ideia e não funciona: o `GM_TOKEN` é secret do projeto Supabase e nenhuma tabela tem coluna que diga a que mesa a linha pertence, então dois tokens no mesmo banco enxergam exatamente as mesmas fichas, NPCs e mapa. Pior: `sessao_publica`, `mapa_publico`, `midia_estado` e `soundpad_estado` são singletons por `check` constraint (uma linha fixa cada), o que impede duas mesas no mesmo banco sem quebrar constraint, ~11 módulos de sync e os nomes de canal Realtime.
- **Caminho escolhido**: um segundo projeto Supabase só pra dev (o free tier permite dois). Rodar as migrações nele, definir um `GM_TOKEN` diferente, e apontar o ambiente local pra ele via `.env.development.local` (já coberto pelo `*.local` do `.gitignore`). O CI continua injetando os secrets de produção no build, e variável de processo tem precedência sobre arquivo `.env` — então `npm run dev` fala com o banco de teste e o deploy fala com o real, sem nenhuma flag no código.
- **O `localStorage` já está isolado de graça**: `localhost:5173` e o Cloudflare Pages são origens diferentes, então o estado local de teste nunca encosta no da mesa real. A ressalva é não usar o site publicado pra testar.
- **Atalho pra quando não precisar de sync**: sem as env vars, `supabase` vira `null` e o app roda 100% local — serve pra qualquer feature que não seja de multiplayer.

### 3. ~~Botão "sessão limpa" (GM-only, aba Log)~~ — concluído em 06/08

`features/sessao/ResetSessao.tsx` (montado em `LogTab.tsx`, fora do `LogView` compartilhado pra não entrar no bundle do jogador) + `multiplayer/resetMesa.ts`. Confirmação em dois passos e backup oferecido antes de apagar.

A armadilha que motivou o módulo separado: `resetarEstado()` já existia no store mas era código morto, e chamá-lo cru seria pior que nada — os syncs só propagam DELETE pra id marcado em `remocaoExplicita.ts`, então fichas e NPCs ficariam órfãos no banco e **voltariam** pra tela no próximo Realtime ou reload, desfazendo o reset sozinho. `resetMesa.ts` marca as cinco coleções primeiro, reseta, e só então apaga `rolls_publicas` — a única tabela que nenhum diff de sync cobre. Fora do alcance de propósito: arquivos no bucket de Storage e as tabelas de auditoria.

### 4. ~~Toda rolagem respeitando a fila de forçados~~ — concluído em 06/08

Onze pontos usavam `Math.random()` direto (iniciativa, surto automático, ação de NPC, estabilizar, dano de arma) — agora todos consomem a fila. Chave `tipo` (`qualquer`/`teste`/`iniciativa`/`dano`/`sanidade`/`surto`) evita que um consumo roube o valor guardado pra outro tipo; ponte neutra `dice/registroForcados.ts` mantém o bundle do jogador honesto por construção (só o mestre registra consumidor). Sorteio de trauma segue honesto, por decisão.

### 5. ~~Migrar imagens pra Supabase Storage~~ — concluído em 08/08

Egress bateu 126% do limite free — fundo de mapa, foto de NPC e foto de ficha ficavam como base64 embutido em coluna Postgres, nunca cacheável pelo navegador. Migrado pro bucket `midia` (prefixo `img/`, mesmo padrão do soundpad, migração `0031_storage_imagens_ficha_dono.sql`) — tabela guarda só a URL, pintura otimista com `dataUrl` local até o upload terminar (`uploadImagemStorage.ts`), fallback gracioso se o Storage rejeitar. `scripts/migrar-imagens-storage.mjs` rodado em produção (08/08): 4 imagens migradas, 0 erros, idempotente. Item encerrado.

### 6. ~~Áudio pro Cloudflare R2 + busca no Freesound + site pro Cloudflare Pages~~ — concluído em 20/08

Áudio (soundpad/jukebox) migrado do Supabase Storage pro R2 (egress zero na leitura), com trava de cota de 8GB e limite de 100MB por arquivo. Soundpad ganhou busca de efeito sonoro direto do Freesound (`buscar-freesound` Edge Function). Site migrado do GitHub Pages pro Cloudflare Pages (`base: '/'`, CI continua rodando lint+test antes do deploy) — detalhe operacional completo em `.claude/docs/storage-r2.md`.

### 7. ~~Caça a bugs: egress do Supabase, sync mestre-jogador, Surto, área de combate~~ — concluído em 20/08

Três rodadas: (1) corrida upload-vs-sync mandava base64 de foto/mapa pro Realtime, `iniciativaSync` sem debounce/diff, log sem limite de histórico, hooks do jogador sem status de canal; (2) Surto ativo não expirava certo ao trocar cena/combate (`expiraEm` media rodada OU cena dependendo do modo, mas a checagem usava o modo ATUAL em vez do modo de criação — Surto sumia ao encerrar combate e reaparecia ao reiniciar); (3) varredura da área de combate: tooltip de iniciativa sem os números reais (e `d20`/`agilidade` se perdiam no sync, migração `0033`), o mesmo bug do Surto duplicado inline em 3 componentes, PV do jogador sem cor por gravidade, "Aguardando" nunca desligava sozinho, AoE rotulando quadrado como "raio". Detalhe em `git log`.

## Checklist do dia da sessão

- [ ] `npm run build` + `npm run preview` funcionando (e o site publicado abrindo)
- [ ] Export JSON de backup salvo fora do navegador
- [ ] Fichas conferidas contra as dos jogadores; mapas importados, NPCs pré-cadastrados
- [ ] Links de jogador enviados; vínculo de mestre ativo (pill `● mestre`)
- [ ] Discord: compartilhar a **janela** do navegador (não a tela), 1080p, "otimizar para vídeo" desligado
- [ ] Determinação de todos resetada para 1
- [ ] d20 físico na mesa por garantia — *fé no rolador do navegador, mas o papel não esquece*

## Próximos passos — ideias capturadas de VTTs (06/08)

Levantamento de features em VTTs maduros (Roll20, Foundry VTT, Fantasy Grounds, Owlbear Rodeo) filtradas pelo modelo da Estática (horror/investigação, mestre compartilha tela no Discord, app do jogador reduzido, local-first com Supabase opcional). Descartado: marketplace, multi-sistema, voz/vídeo embarcado, worldbuilding 3D, sistema de extensões Lua/XML — nada disso se aplica.

### Tier 1 — alta aderência ao tema, reaproveita infraestrutura já existente

| # | Ideia | Origem | Por que encaixa |
|---|---|---|---|
| **F1** | **~~Fog of war no mapa~~** (máscara de revelação controlada pelo GM, sync pro app do jogador) — **implementado em 06/08** | Roll20, Foundry, FG | Três camadas CSS (`vistas`/`visiveisAgora`/nunca), cada uma com assinatura visual própria: chiado P&B (canal sem sinal), frame congelado degradado (`backdrop-filter` + scanlines + microcopy `seen · timestamp`), luz atual com vinheta sutil + burst de 280ms com chroma aberration na transição ("sintonizando"). Zona por região (`rua` = âmbar `--real`, `corporativo` = ciano `--rede`, default P&B puro). Persistente (`EstadoFoW` em `mapa.fow` + tabela `fow_estado` migration 0027); toolbar GM-only (`FoWOverlay.tsx`), render compartilhado (`FoWViewOverlay.tsx`). `fowSync` espelha `mapaPublicoSync` (singleton, RLS `is_gm()`). `resetMesa` DELETE explícito de `fow_estado`. Arquivos: `features/mapa/FoW{Overlay,ViewOverlay}.tsx`, `fowGeometria.ts`, `state/fowStore.ts`, `multiplayer/fowSync.ts`, `styles/fow.css`. |
| **F2** | **Relógio de tensão in-game** (relógio manual, atado aos gauges de Ruído/Ameaça) | Foundry (módulos) | Investigação tem pressão de tempo ("até o amanhecer"). Concentrado na aba Sessão, perto dos gauges já existentes. (Movido de "Ideias sem prioridade".) |
| **F3** | **Anotações no mapa** (desenhos/marcadores do GM, sync — possível camada GM-only vs pública) | Roll20, Foundry, FG | Marcar sangue, pistas, conexões. Aproveita o mesmo canal Realtime dos tokens. |
| **F4** | **Handouts (empurrar imagem/doc pro app do jogador)** | Roll20, Foundry, FG | Investigação vive de pistas visuais. Reaproveita a aba Pistas + Realtime. (Movido de "Ideias sem prioridade".) |
| **F5** | **Música atada à cena** (troca de mapa → troca automática de trilha) | Roll20, Foundry | Jukebox já sincronizada; só falta metadados cena→track. Lift pequeno, imersão grande. |
| **F6** | **Tabelas aleatórias** ("encontros de rua de São Paulo", "ruídos noturnos", "eventos de surto") | Roll20, Foundry, FG | Específicas pro setting distópico. Rolagem → resultado no log. Sub-seção em Dados ou Pistas. |
| **F7** | **Gatilhos narrativos ao cruzar limiares de Ruído/Ameaça** | — | Casa com relógio de tensão e FoW: ao atingir threshold, dispara efeito (overlay, som, mudança de cena). (Movido de "Ideias sem prioridade".) |

### Tier 2 — bom encaixe, mais lift ou parcialmente coberto

- **Visão/lanterna de token** (paired com FoW) — lanterna limitada é horror clássico, mas adiciona complexidade no render; segundo momento.
- ~~**Ping/apontar no mapa**~~ — **implementado em 07/08**. Clique sem arrastar em `.mapa-area` (mestre OU jogador — mesma simetria da régua) dispara um pulso na cor de quem clicou, visto por todo mundo, some sozinho em ~1.4s. Reaproveita o gesto da régua: `useRegua.ts` só decide "é régua ou é ping" pela distância percorrida desde o `pointerdown` (limiar de 5px, mesmo princípio do clique-vs-arrasto de token em `MapaTab.tsx`) — abaixo disso nenhuma régua fantasma chega a ser publicada. Store efêmero `state/pingsStore.ts`, broadcast simples (sem tabela, sem debounce, sem evento de cancelamento — um ping nasce pronto) em `multiplayer/pingSync.ts`, render compartilhado `features/mapa/PingOverlay.tsx`.
- **Sussurro privado pra um jogador** — GM envia nota só pra um aparelho. Combina com "você nota algo que só você vê".
- **Bestiário/NPCs persistentes entre sessões** — hoje NPCs são por sessão; uma biblioteca evita re-setup a cada jogo.
- **Macros de rolagem** — salvar presets de "Perception", "Investigation" (com 15 perícias, poupa cliques recorrentes).
- **Overlays atmosféricos na cena** (chuva, neblina estática) — extender o tier atual de ruído visual p/ o mapa.

### Tier 3 — toques pequenos

- Turn timer no combate (tensão de pacing).
- Transição de cena (fade to black/vermelho) ao trocar de mapa ou cruzar limiar de Ameaça.
- Indicador de atividade noutra aba — generalizar o "aviso fora da aba" já mapeado para o dado remoto.

### Próxima implementação (a partir de 06/08)

Tier 1, em ordem: ~~**F1 Fog of war**~~ (06/08) · **F2 Relógio de tensão** · **F3 Anotações no mapa**. Cada uma ganha levantamento técnico próprio quando sair do backlog (desenho + pegadinhas, não código).
