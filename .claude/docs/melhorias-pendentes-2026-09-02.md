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

**Plano, não implementado ainda.**

Diagnóstico (alta confiança, código lido diretamente):
- O sistema de abas do jogador é `visibility`/`pointer-events`, todas as 7 abas montadas estaticamente, **sem** `React.lazy`/`import()` dinâmico em produção (`PlayerApp.tsx:3-16,251-385`) — descarta a hipótese de "chunk de aba obsoleto" ao trocar de aba dentro do app.
- Mecanismo mais provável: o navegador descarta a aba em background (tab discarding/"memory saver", comum ao trocar pro Discord durante a sessão) e, ao voltar o foco, força uma **navegação nova completa** de `jogador.html`. Se isso cair na janela de propagação de um deploy no Cloudflare Pages, o HTML pode vir com hash de asset que já não bate com o que está publicado — o `<script type="module">` de entrada dá 404 antes do React sequer inicializar.
- `ErrorBoundary.tsx` **não cobre esse caso** (só pega exceção de render de componente já montado, e o React nunca chega a montar nada). `globalErrorHandler.ts:23-25` também não cobriria (listener sem fase de captura, e só é registrado depois que o script de entrada já carregou — o que não aconteceu).
- Nenhum listener de `visibilitychange` existente (`store.ts:298-300`, `filaPendencias.ts:95-97`, `useRegua.ts:134-137`) mexe em rede de assets — todos fazem só flush de gravação local, não causam o bug.

Correção recomendada (duas partes complementares):
1. **`public/_headers`** (Cloudflare Pages) — política explícita de cache: `index.html`/`jogador.html` com `Cache-Control: no-cache`, assets hasheados (`/assets/*`) com `Cache-Control: immutable`. Reduz a janela de inconsistência entre HTML e asset servidos.
2. **Listener de erro em fase de captura** nos entries (`src/entries/jogador.tsx`, `src/entries/mestre.tsx`) — detecta falha de carregamento do `<script>`/`<link>` de entrada e faz **um único** reload automático (guardar flag em `sessionStorage` pra não entrar em loop se o problema for outro).

Arquivos a tocar quando for implementar: `vite.config.ts` (conferir build), `public/_headers` (novo), `src/entries/jogador.tsx`, `src/entries/mestre.tsx`.

## 4. Dado do jogador no header em vez de abrir QuickRollOverlay

**Plano, não implementado ainda.**

Hoje: os botões de ataque/dano/perícia (`ArmasSection.tsx`, `PericiasSection.tsx`) disparam `pedidoRolagemDano`/`pedidoRolagemTeste`, que forçam `setOverlayAberto(true)` (`PlayerApp.tsx:84`, espelho em `App.tsx:299` pro mestre). A física do dado 3D só existe dentro do `QuickRollOverlayJogador` porque o `<div id="dice-overlay-jogador">` só é montado com `aberto=true`. O header (`RolagemAoVivoPlayer.tsx`) já fica sempre montado, mas hoje só **reproduz** rolagens de outros jogadores — nunca **rola** fisicamente algo novo, e filtra a própria rolagem por design (`useReproduzirRolagemAoVivo.ts:28-33` — a premissa original era que o overlay já mostrava pro próprio jogador).

O broadcast pra mesa toda **já funciona** hoje (`rolarDanoArmaFicha`/`rolarTestePericiaFicha` já chamam `marcarComoProprio` + `definirAtual`) — o gap é só de onde a física/animação roda no lado de quem rolou.

Passos recomendados:
1. Parar de forçar `setOverlayAberto(true)` em `pedidoDano`/`pedidoTeste` de ataque/dano/perícia (manter só pro atalho "R" de rolagem livre, que é intencionalmente overlay).
2. Mover a física de `executarPedidoDano`/`executarPedidoTeste` (`QuickRollOverlayJogador.tsx:167-209`) pra dentro da bandeja sempre-montada `dice-ao-vivo` do `RolagemAoVivoPlayer.tsx` (hoje só chama `reproduzir`; passaria a também `rolar` fisicamente o pedido do próprio jogador) — ou extrair um hook compartilhado entre os dois componentes.
3. Ajustar o filtro `ehRolagemPropria`/`ignorarFiltroPropria` (`useReproduzirRolagemAoVivo.ts:33`) pra que, com a física migrada, o resultado realmente apareça no header do próprio jogador.

## 5. Botão "anterior" no combate

**Implementado nesta rodada.** Nova action `voltarTurno` na store, ao lado de `avancarTurno` — reverte só o índice de turno e a rodada (wrap em ambas as direções). Botão "◀ anterior" ao lado do "▶ próximo" em `IniciativaPanel.tsx`, `CombatOverlay.tsx` e `NpcsTab.tsx`.

**Limitação conhecida, aceita de propósito**: `avancarTurno` decrementa/expira durações de condição de combate (`decrementarDuracoesCombate`) sem guardar histórico — `voltarTurno` não desfaz isso, só reverte a posição do turno. Um "anterior" fielmente reversível exigiria uma pilha de snapshots de estado, o que é over-engineering pro caso de uso real (mestre clicou "próximo" por engano).

## 6. Marcar NPC como desacordado/morto, visível no mapa e na aba Combate

**Implementado nesta rodada.** Toggle manual pros dois estados, reaproveitando `CONDICOES_COMBATE`/`alternarCondicaoCombate` (`rules/data/condicoesCombate.ts`, `store.ts:1148-1168`) — dois novos ids (`desacordado`, `morto`) aparecem automaticamente como chip toggle em todo lugar que já renderiza `CONDICOES_COMBATE.map(...)`: `IniciativaPanel.tsx` (aba Combate/NPCs) e o popover de token no mapa (`TokenOverlay.tsx`), sem nenhuma UI nova.

O estado final exibido é sempre **toggle manual OU cálculo automático de PV** (`estaMorto`/`estaForaDeCombate`) combinados — o mestre pode marcar mesmo quando o PV não bate com a regra. No mapa do mestre (`MapaTab.tsx`) os dois lados existem porque o mestre tem acesso a todos os dados; no mapa do jogador (`MapaJogadorView.tsx`) o automático só funciona pro próprio personagem do jogador (PV de terceiros é privado — `fichaSplit.ts`/`npcsSync.ts` não expõem PV de outros PCs nem de NPC pro cliente do jogador), então pra qualquer outro token o indicador depende 100% do toggle manual do mestre. Visual: `data-morto`/`data-desacordado` no `.mapa-token` (`mapa.css`) — grayscale+opacidade pra desacordado, grayscale total + caveira sobreposta pra morto.

**Limitação conhecida, aceita de propósito** (decisão do usuário, avaliando a alternativa de um campo persistente novo com migração de banco): `condicoesCombate` é zerado toda vez que o combate encerra (`encerrarModoCombate`) — uma marcação manual de "morto"/"desacordado" **some do mapa** quando o mestre clica "encerrar" combate, junto com todas as outras condições (mirando, exposto etc.). Pra continuar aparecendo depois de encerrar, precisa marcar de novo. A alternativa robusta (campo `statusVital` persistente no NPC/ficha, sobrevivendo a esse reset) exigiria migração de schema no Supabase de produção — descartada por ora.
