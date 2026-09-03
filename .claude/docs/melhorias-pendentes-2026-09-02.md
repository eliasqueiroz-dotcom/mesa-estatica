# Melhorias pendentes — 02/09/2026

Levantamento de 6 pontos pedidos pelo usuário após a sessão. Itens 2 e 5 já foram implementados nesta rodada (ver commits referenciados); os demais ficam registrados aqui como plano.

## 1. Auditoria dos hotfixes de 30/08

Os 5 commits `fix:` de 30/08 foram revisados um a um (leitura do diff + do código atual ao redor) pra checar se a correção resolveu a causa raiz ou só o sintoma.

| Commit | O que mudou | Veredito | Recomendação |
|---|---|---|---|
| `dd620d1` — loop de faixa não reiniciava | `MidiaPlayerGM.tsx:97-116` passa a chamar `audio.currentTime=0`/`audio.play()` direto no handler nativo `onEnded`, além do `useEffect` que já existia | **Causa raiz** — autoplay policy do navegador trata `.play()` síncrono dentro do handler do evento com mais confiança do que o mesmo `.play()` disparado de um `useEffect` (que roda ticks depois) | Nitpick não bloqueante: o `useEffect` (linhas 42-85) ainda reexecuta o mesmo `play()` por cima — dá pra podar esse caminho redundante da próxima vez que mexer no arquivo |
| `cfdc59c` — condições sumindo em combate multiplayer | `sessaoPublicaSync.ts:103-152` — baseline + `select` antes do `upsert` da linha singleton `sessaoPublica` | **Mitigação parcial** — o próprio comentário do código (linha 114) admite janela de corrida residual entre o `select` e o `upsert` | Correção mais robusta: granularizar a escrita de `condicoesCombate`/`condicaoDuracao` (tabela própria por participante, ou função Postgres com merge server-side) em vez de upsert de linha inteira last-write-wins |
| `0c2a3f5` — ruído forte reagindo a refresh/sanidade errada | Dois fixes independentes: exclui `ultimoBurstRuidoEm` do `partialize` + guarda por idade em `RuidoOverlay.tsx:68-70`; nova prop `incluirSanidade={false}` no mestre (`App.tsx:405`) | **Causa raiz, a correção mais sólida das 5** — separa explicitamente "ficha aberta no painel do mestre" de "personagem do jogador", com defesa em duas camadas pro burst | Nenhuma pendente |
| `da5c7c8` — aba mídia do jogador vazava próximas músicas | `MidiaJogadorView.tsx` passa a renderizar só `faixaAtual`, não a playlist ordenada inteira | **Causa raiz pro sintoma de UI** | Ressalva: `midia.faixas` completo ainda chega no payload do jogador (`useHidratarMidia`) — quem abre o DevTools ainda lê a lista completa. Proporcional ao problema relatado (spoiler de UX, não segurança), mas vale registrar caso vire preocupação séria depois |
| `e0ae4b8` — nome grande quebra header do jogador | `PlayerApp.tsx:200-244` — `flexWrap`/`minWidth:0` no container e no `h1`, `flexShrink:0` nos irmãos (nav/widgets) | **Causa raiz, solução idiomática** para o bug clássico de `min-width:auto` implícito em flexbox | Nenhuma pendente |

## 2. Campos numéricos (PV, Sanidade, Atributos, campos de NPC): commit só no blur/Enter

**Implementado nesta rodada.** Antes, o `onChange` dos inputs numéricos chamava a action da store a cada tecla — como os efeitos colaterais (checagem de Surto, linha de Trauma, burst de ruído, clamp de morte) rodam **dentro da própria action**, um valor intermediário durante a digitação (ex. apagar "15" pra digitar "10") já disparava alertas com o número errado.

Fix: os inputs afetados (`AtributosDerivadosSection.tsx`, `NpcsTab.tsx`, `TokenOverlay.tsx`) passaram a manter um rascunho local (`useState`) e só chamam a action real da store no `onBlur` ou `Enter` — a digitação em si não toca mais a store.

## 3. Bug de tela branca ao voltar de aba durante deploy

**Implementado nesta rodada.**

Diagnóstico: navegador descarta a aba em background (tab discarding, comum ao trocar pro Discord) e, ao voltar o foco, força uma navegação nova completa. Se isso cair na janela de propagação de um deploy no Cloudflare Pages, o HTML pode vir com hash de asset que já não bate com o publicado — o `<script type="module">` de entrada dá 404 antes do React sequer inicializar, e nada DENTRO do bundle (`ErrorBoundary`, `globalErrorHandler`) roda pra recuperar, porque o bundle nunca carregou.

Fix (duas partes):
1. **`public/_headers`** — HTML (`/`, `/index.html`, `/jogador.html`) sempre `Cache-Control: no-cache`; assets hasheados (`/assets/*`) `immutable`. Reduz a janela de inconsistência entre HTML e asset servidos pelo Cloudflare Pages.
2. **Listener de erro em fase de captura**, inline no `<head>` de `index.html`/`jogador.html` (não dentro do bundle React — precisa estar registrado ANTES da tag do módulo começar a carregar, e o próprio bundle não roda se o carregamento falhar). Detecta falha de carregamento de `<script>`/`<link>` e faz um reload automático, guardado por flag em `sessionStorage` pra não entrar em loop. `src/entries/jogador.tsx`/`mestre.tsx` limpam essa flag assim que o bundle carrega de verdade, pra um deploy seguinte na mesma aba ainda ganhar uma nova tentativa.

Achado importante durante a implementação: o Vite **promove `<script type="module">` pro `<head>` no build**, mesmo declarado no `<body>` na fonte (confirmado no `dist/index.html` gerado) — o listener precisou ir pro `<head>`, antes de qualquer outra tag, senão registraria tarde demais pra pegar a falha. Verificado isolado (HTML de teste fora do bundle, fora do Supabase de produção): script quebrado gera exatamente 1 reload automático, depois o guard de `sessionStorage` impede o segundo — sem loop.

## 4. Dado do jogador no header em vez de abrir QuickRollOverlay

**Implementado nesta rodada.**

`RolagemAoVivoPlayer.tsx` ganhou uma prop opcional `ficha` (só passada em `PlayerApp.tsx`, nunca em `App.tsx`/mestre) — quando presente, a mesma bandeja sempre-montada (`dice-ao-vivo`) que já reproduzia rolagens de outros jogadores passa também a **executar** (`rolar()`, física de verdade) os pedidos de dano/teste da própria ficha (`pedidoRolagemDanoStore`/`pedidoRolagemTesteStore`), migrados de `QuickRollOverlayJogador.tsx`. `PlayerApp.tsx` parou de forçar `setOverlayAberto(true)` nesses pedidos — o popup "d20 rápido" (atalho "R") continua existindo do jeito que estava, só perdeu a lógica de dano/teste que não era dele.

Achado que simplificou a migração: `rolarDanoArmaFicha`/`rolarTestePericiaFicha` (`rules/armasCombate.ts`, `rules/testePericia.ts`) **já cuidavam** de log/registro/broadcast pra `rolagemAoVivoStore` sozinhas — não foi preciso duplicar essa parte. E o filtro `ehRolagemPropria` (`useReproduzirRolagemAoVivo.ts`) não precisou de nenhum ajuste: como a física agora roda direto neste componente (não mais via `reproduzir`/replay), o filtro que ignora o próprio broadcast continua correto — evita que a MESMA rolagem seja animada duas vezes (uma pela execução direta, outra pelo replay do próprio eco).

Guard important: `executarPedidoDano`/`executarPedidoTeste` e os efeitos que os disparam checam `if (!ficha) return` — sem isso, a instância do MESTRE (`App.tsx`, que também renderiza `RolagemAoVivoPlayer`) reagiria aos próprios `pedidoRolagemDanoStore`/`pedidoRolagemTesteStore` (usados por `QuickRollOverlay.tsx`, mestre-side) e executaria a física duas vezes.

## 5. Botão "anterior" no combate

**Implementado nesta rodada.** Nova action `voltarTurno` na store, ao lado de `avancarTurno` — reverte só o índice de turno e a rodada (wrap em ambas as direções). Botão "◀ anterior" ao lado do "▶ próximo" em `IniciativaPanel.tsx`, `CombatOverlay.tsx` e `NpcsTab.tsx`.

**Limitação conhecida, aceita de propósito**: `avancarTurno` decrementa/expira durações de condição de combate (`decrementarDuracoesCombate`) sem guardar histórico — `voltarTurno` não desfaz isso, só reverte a posição do turno. Um "anterior" fielmente reversível exigiria uma pilha de snapshots de estado, o que é over-engineering pro caso de uso real (mestre clicou "próximo" por engano).

## 6. Marcar NPC como desacordado/morto, visível no mapa e na aba Combate

**Implementado nesta rodada.** Toggle manual pros dois estados, reaproveitando `CONDICOES_COMBATE`/`alternarCondicaoCombate` (`rules/data/condicoesCombate.ts`, `store.ts:1148-1168`) — dois novos ids (`desacordado`, `morto`) aparecem automaticamente como chip toggle em todo lugar que já renderiza `CONDICOES_COMBATE.map(...)`: `IniciativaPanel.tsx` (aba Combate/NPCs) e o popover de token no mapa (`TokenOverlay.tsx`), sem nenhuma UI nova.

O estado final exibido é sempre **toggle manual OU cálculo automático de PV** (`estaMorto`/`estaForaDeCombate`) combinados — o mestre pode marcar mesmo quando o PV não bate com a regra. No mapa do mestre (`MapaTab.tsx`) os dois lados existem porque o mestre tem acesso a todos os dados; no mapa do jogador (`MapaJogadorView.tsx`) o automático só funciona pro próprio personagem do jogador (PV de terceiros é privado — `fichaSplit.ts`/`npcsSync.ts` não expõem PV de outros PCs nem de NPC pro cliente do jogador), então pra qualquer outro token o indicador depende 100% do toggle manual do mestre. Visual: `data-morto`/`data-desacordado` no `.mapa-token` (`mapa.css`) — grayscale+opacidade pra desacordado, grayscale total + caveira sobreposta pra morto.

**Limitação conhecida, aceita de propósito** (decisão do usuário, avaliando a alternativa de um campo persistente novo com migração de banco): `condicoesCombate` é zerado toda vez que o combate encerra (`encerrarModoCombate`) — uma marcação manual de "morto"/"desacordado" **some do mapa** quando o mestre clica "encerrar" combate, junto com todas as outras condições (mirando, exposto etc.). Pra continuar aparecendo depois de encerrar, precisa marcar de novo. A alternativa robusta (campo `statusVital` persistente no NPC/ficha, sobrevivendo a esse reset) exigiria migração de schema no Supabase de produção — descartada por ora.

## 7. Áudio: "habilitar áudio" não persiste + loop de faixa não continua (03/09)

**Implementado.** Dois bugs de áudio levantados numa rodada separada.

**"Habilitar áudio" não persistia entre reloads** (`MidiaPlayerJogador.tsx`) — era um `useState` puro, perdido em qualquer F5. Não dá pra usar a store principal (`persist` é no-op no bundle do jogador, de propósito — `store.ts`, senão o jogador herdaria o estado da MESA anterior). Fix: `localStorage` direto, mesmo padrão de `CHAVE_TOKEN_MESTRE` (`multiplayer/auth.ts`). Fallback importante: se o `.play()` automático (sem gesto novo nesta carga) for negado com `NotAllowedError`, reverte a preferência salva e reexibe o botão — sem isso, um navegador que ainda não acumulou engajamento suficiente pra liberar autoplay (comum: 1ª sessão, Firefox/Safari) deixaria o jogador sem som e sem nenhum caminho de retry visível.

**Loop de faixa não continuava ao terminar** (`MidiaPlayerGM.tsx`, `MidiaPlayerJogador.tsx`) — o handler `onEnded` de um fix anterior (`dd620d1`, 30/08) reinicia a faixa direto (`currentTime=0; play()`), mas o `useEffect` passivo que espelha `s.midia` no `<audio>` reage ao mesmo `atualizadoEm` que esse restart dispara, e roda de novo em cima — reatribuindo `currentTime` e chamando `play()` uma SEGUNDA vez enquanto a primeira ainda podia estar em voo. Reatribuir `currentTime` com uma `play()` pendente é gatilho documentado (inclusive pelo Chrome) de rejeição por interrupção da Promise — e nem o handler nem o efeito tratavam nada além de `NotAllowedError`, então a rejeição sumia em silêncio e o áudio simplesmente parava.

Fix: dois guards por VALOR (não por contagem de execução — cobrem também um possível 3º ciclo via eco do Realtime em modo multiplayer, que um "pula uma vez" não cobriria): (1) só reatribuir `audio.currentTime` se for diferente do valor já presente (igualdade exata, sem tolerância — um seek manual real quase nunca bate exatamente com o `currentTime` de ponto flutuante, então nenhum seek de verdade é suprimido); (2) só chamar `audio.play()` se `audio.paused` for `true` (uma troca de faixa de verdade já reseta `paused` via reatribuição de `.src`, confirmado contra a spec HTML — o guard não afeta esse caminho). Blindagem extra: `aoTerminar` agora também limpa `bloqueado` no sucesso do próprio `play()` direto, já que o efeito passivo deixa de rodar de novo pra fazer isso.

Verificação: `tsc`, `npm test` (719 testes, sem infra de teste de componente React neste repo) e `npm run build` passam limpos. Verificação de áudio tocando de verdade fica pra manual — sem acesso a testar isso via ferramenta automatizada, e o preview local está atrás do gate de token de mestre.
