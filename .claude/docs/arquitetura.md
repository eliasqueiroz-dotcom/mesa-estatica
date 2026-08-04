# Estática — Arquitetura Técnica

## Decisões (fechadas — não reabrir sem motivo forte)

| Decisão | Escolha | Por quê |
|---|---|---|
| Build | **Vite** | dev rápido; `build` gera pasta estática servível offline |
| UI | **React 18 + TS** | ficha é CRUD reativo denso; derivados caem de graça |
| Estado | **Zustand + `persist`** | localStorage sem boilerplate; selectors evitam re-render da ficha inteira a cada tecla |
| Dados 3D | **`@3d-dice/dice-box-threejs`** | única com resultado forçado nativo (`1d20@X`) — ver abaixo. Menos mantida (2022), mas traz o próprio Three bundlado |
| Tokens 3D | **cena Three.js própria** | separada da dos dados; usa o `three@0.169` do projeto. Duas instâncias de Three convivem (só um warning no console) |
| Fontes | **@fontsource** self-host | zero dependência de CDN em runtime |
| Backend | **nenhum próprio**; Supabase opcional | mestre único + screen share. Sync (Realtime/Edge Functions) é camada opcional: sem env vars o app roda 100% local |

## Rolagem: honesta por padrão + modo forçado do mestre

O plano original dizia "sempre honesta, nunca `1d20@X`". **O usuário reverteu**: quer forçar quando precisar, controlando de **fora** da janela compartilhada.

- **Padrão honesto**: UI monta o contexto → `roll('1d20')` (física) → motor soma modificadores e classifica → log. Física decide o dado; matemática decide o teste.
- **Exceção forçada**: valores enfileirados pela janela `#controle` viram notação `1d20@X` — a lib faz *swap da face* depois que a física assenta, então o dado cai fisicamente no valor escolhido, indistinguível na tela.

Por que não o `@3d-dice/dice-box` (Babylon), usado antes: **só a versão threejs suporta `@` nativo.** No Babylon o valor vem de raycast na face assentada, em web-worker offscreen com a cena em campos privados — forçar exigiria forkar a lib.

### Fluxo do forçado

- [`src/dice/forcarRolagem.ts`](../../src/dice/forcarRolagem.ts) — canal **BroadcastChannel** (`estatica-forcar-dados`). Controle chama `enviarForcados(valores, umaVez)`; janela principal chama `consumirForcados(totalDados)` ao rolar. `umaVez` (padrão) força só a próxima; sync bidirecional.
- [`src/dice/useDiceBox.ts`](../../src/dice/useDiceBox.ts) — converte `RollTermo[]`/string → notação da lib, anexa `@v1,v2,…` se há força enfileirada, e traduz o resultado de volta pro shape que os roladores consomem. Valores forçados são o **valor bruto do dado**, um por dado na ordem (modificadores somam depois).
- [`src/features/controle/ControlPanel.tsx`](../../src/features/controle/ControlPanel.tsx) — janela secreta (hash `#controle`, `window.open`). Mesma origin → BroadcastChannel sem backend, funciona offline.

### API da lib (não publica tipos — decl. à mão em `src/dice/dice-box-threejs.d.ts`)

- Construtor de **2 argumentos**: `new DiceBox('#seletor', { assetPath, theme_customColorset, … })`.
- `initialize()` async **precisa ser aguardado** antes de rolar.
- `roll(notation)` → `{ notation, sets: [{ num, sides, rolls: [{value}], total }], modifier, total }`. Combinada: `1d8+1d20`; forçada: `1d8+1d20@5,15` — **um único `@`, no fim** (o parser quebra com mais de um).
- Cor: `theme_customColorset.foreground` = números (âmbar), `background` = corpo (ciano). Sem recolorir textura.
- Assets copiados de `node_modules/@3d-dice/dice-box-threejs/public/` para `public/assets/dice-box-threejs/` por [`scripts/copy-dice-assets.mjs`](../../scripts/copy-dice-assets.mjs) no `postinstall`.

## Convenções estruturais

- **`src/rules/` é TS puro, sem React/Three** — testável com vitest, e é onde mora a fidelidade ao `regras.md`.
- **Abas não desmontam**: o shell controla `visibility`/`pointer-events`, nunca render condicional. Desmontar zera o `useState` dos roladores e dispara o cleanup do `useDiceBox` (que faz `replaceChildren()` na bandeja — o dado sumia).
- **Persistência**: zustand/persist com `version` + `migrate`; toda mudança de shape bumpa `SCHEMA_VERSION` (`factories.ts`) e ganha bloco `if (versaoAnterior < N)`.
- **Público vs. privado**: o que só o mestre vê fica em `sessaoPrivada` e leva badge "privado" na UI. Roladores leem a DT da cena via `useDtDaCena()` sem exibir o número.
- **Export/Import JSON é obrigatório** — localStorage é frágil (limpeza de navegador, perfil errado). Imagem de mapa como dataURL tem limite (~5MB): comprimida a ~1600px na importação.

## Dados, tokens e performance

- Fila de rolagens: uma por vez, inputs travados até completar (`roll()` concorrente corrompe a lib). Colorsets `rede` (ciano) e `ruido` (âmbar/vermelho) — Sanidade e Surto sempre em `ruido`. **Fallback 2D** com `crypto.getRandomValues` se WebGL falhar: o jogo nunca trava por causa do 3D.
- Mapa é `<img>` com `object-fit: contain` + camada de tokens; posição é fração 0–1 **relativa à imagem**, nunca ao container (`getImgRenderRect`), recalculada por `ResizeObserver` — consistente entre resoluções, requisito do multiplayer.
- Canvas Three.js transparente por cima, câmera ortográfica. Animação idle num único rAF, pausada quando a aba não está visível.
- Budget de screen share: 60fps ao arrastar, `devicePixelRatio` limitado a 1.5, camada de ruído só com `transform`/`opacity` e zero JS por frame. Virtualizar o log só acima de ~500 entradas.
