# ROADMAP — Mesa de Estática

> Painel de mestre: ficha viva, motor de regras, dados 3D, mapa com tokens, app do jogador e sync via Supabase. Publicado no GitHub Pages.
> Próxima sessão de jogo: **29/08/2026**. Docs: [regras](.claude/docs/regras.md) · [ficha](.claude/docs/ficha.md) · [arte](.claude/docs/arte.md) · [arquitetura](.claude/docs/arquitetura.md) · [multiplayer](mesa-estatica-multiplayer-completo.md).
>
> **Histórico detalhado fica no `git log`, não aqui.** Este arquivo guarda: estado atual, invariantes que não podem ser re-quebradas, e o que vem a seguir.

## Estado atual

Tudo abaixo está implementado, testado e em produção salvo indicação em contrário.

- **Ficha e regras**: ficha completa (`ficha.md`), motor em `src/rules/` puro e testado, indicadores mecânicos (Ferido, linha da Sanidade, Surto com perda ≥5, traumas), neuro-reguladores, dinheiro R$/P$ com câmbio, Kit de Investigação, export `.docx` + import via IA (sobrescreve por nome).
- **Dados**: 3D com colorsets por tipo de rolagem, fila de rolagens, fallback 2D sem WebGL, rolagem rápida em qualquer aba. Honesta por padrão; forçada só pela janela `#controle`.
- **Mapa/combate**: upload comprimido, tokens arrastáveis com cristal 3D, grade configurável, régua de medição, AoE (círculo/quadrado), `CombatOverlay` com iniciativa, condições, glossário e drag-and-drop.
- **Sessão**: dashboard público/privado, gauges de Ruído Narrativo/Ameaça com reflexo visual site-wide, ruído de Sanidade por tiers, log narrativo + `rollsLog` separados com visibilidade, aba Pistas (GM-only), jukebox sincronizado.
- **Multiplayer (Supabase)**: Fases A e B em produção (tokens; fichas com dono real via Anonymous Auth + RLS). App do jogador (`jogador.html`) com paridade: ficha própria editável, roladores, mapa, combate read-only, log, mídia.
- **Fase C** (Edge Function `resolver-rolagem`) construída mas **não ligada** no caminho do mestre. **Fase D** atrás da flag `VITE_FASE_D_ROLAGEM_REMOTA` (**off por padrão**) — falta teste com 2 aparelhos físicos antes de ativar.

## Invariantes — aprendidas na marra, não re-quebrar

Cada uma custou um bug real em produção ou ao vivo numa sessão.

- **Exclusão nunca por diff.** Sync infere criação/edição por diff, mas remoção só propaga se a UI marcou de propósito (`multiplayer/remocaoExplicita.ts`). O `GM_TOKEN` é compartilhado — uma aba com lista desatualizada apagava fichas/NPCs/tokens de todo mundo.
- **Flag de "aplicando remoto" é contador, não boolean.** Duas tabelas disparam dois eventos Realtime pro mesmo push; com boolean, o primeiro a terminar zera a flag e o segundo vaza como edição local → loop exponencial de requests.
- **Coordenadas do mapa são % da IMAGEM renderizada**, nunca do container (`getImgRenderRect`/`retanguloGradeEmPx` em `mapaUtils.ts`) — edição E renderização. Container varia por dispositivo; misturar as duas bases desalinha mestre e jogador.
- **Notação de dado forçado aceita um único `@` no fim** — o parser da lib quebra com mais de um. `consumirForcados` é exclusivo do `useDiceBox` (sorteio de trauma usa `Math.random` puro).
- **Visibilidade de rolagem precisa existir no banco.** `registrarLog` (texto livre) e `registrarRoll` são canais paralelos: filtro client-side não basta, a coluna + RLS têm que existir, senão o eco do Realtime devolve a entrada sem visibilidade e vaza.
- **Bundle do jogador não persiste em localStorage** (storage condicional no `persist`) — os dois bundles rodam na mesma origin e compartilhariam a chave `estatica-mesa`.
- **Fallback de array em selector do Zustand precisa ser constante fora do componente** (`EMPTY_CONDICOES`) — `?? []` inline cria array novo a cada render e quebra com "getSnapshot should be cached".
- **Canvas WebGL é criado via `document.createElement` e destruído no cleanup**, nunca um `<canvas>` fixo do JSX — um canvas aceita um contexto WebGL por vida inteira, e StrictMode/remount quebram nisso.
- **Token em arrasto ignora eco remoto** (`tokensEmArrasto` em `tokensSync.ts`), senão a posição pula durante o arrasto.
- **HMR longo corrompe o React**: "Invalid hook call" numa aba antiga depois de editar hook não é bug — abrir aba nova.

## Próximos passos — confiabilidade pós-publicação

O app nasceu local; agora tem URL pública. Auditoria (tratamento de erro, RLS, build/deploy) levantou os gaps abaixo. **Fase 0 é a próxima a implementar**; o resto fica registrado.

### Fase 0 — evitar perda de dados ao vivo (próxima)

1. **Try/catch em `criarStorageComDebounce`** (`src/state/store.ts`) — `setItem/getItem/removeItem` não tratam `QuotaExceededError` nem localStorage indisponível (Safari privado); hoje a mesa pode sumir em silêncio.
2. **Indicador visual de status** (salvo local / sync conectada) — os 12 módulos de `src/multiplayer/` tratam falha de rede só com `.catch(console.error)`; o mestre não descobre que parou de sincronizar. Reusar o padrão de badge (`EstadoMesaSection.tsx`) e o desacoplamento de `debounce.ts`.
3. **Backup automático/periódico** — usar `exportarJSON` já existente, como última linha de defesa se local e Supabase falharem juntos.

### Fase 1 — evitar a tela travar

- Error Boundary React em `src/entries/mestre.tsx`/`jogador.tsx` (hoje `<StrictMode>` puro, sem fallback).
- Handler global `window.onerror`/`unhandledrejection` (inexistente).
- Validação de shape em `importarJSON` — hoje valida só a presença de 6 chaves; tipos errados passam e quebram depois.

### Fase 2 — segurança pós-publicação

- Rate limit na Edge Function `vincular-mestre` — compara token por string simples, sem limite de tentativas.
- Reavaliar RLS aberta em `tokens`/`forced_queue`/mídia — as migrations a justificam com "o link não é divulgado", premissa que mudou.
- Aviso visível quando `supabase === null` em produção — hoje só `console.warn` em DEV; secrets erradas publicam sem multiplayer, em silêncio.
- Auditoria de reuso de token em `vincular-jogador`.

### Fase 3 — nice to have

- Detecção de offline + fila de pendências · ESLint no CI · `404.html`/`robots.txt`.

### Ideias sem prioridade

Recap automático de sessão a partir do log · relógio de tensão ligado aos gauges · gatilhos narrativos ao cruzar limiares de Ruído/Ameaça · handouts (compartilhar imagem/documento) · indicador sutil de Sanidade no jogador.

## Checklist do dia da sessão

- [ ] `npm run build` + `npm run preview` funcionando (e o site publicado abrindo)
- [ ] Export JSON de backup salvo fora do navegador
- [ ] Fichas conferidas contra as dos jogadores; mapas importados, NPCs pré-cadastrados
- [ ] Links de jogador enviados; vínculo de mestre ativo (pill `● mestre`)
- [ ] Discord: compartilhar a **janela** do navegador (não a tela), 1080p, "otimizar para vídeo" desligado
- [ ] Determinação de todos resetada para 1
- [ ] d20 físico na mesa por garantia — *fé no rolador do navegador, mas o papel não esquece*
