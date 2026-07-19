# Estática — Arquitetura Técnica

## Decisões (fechadas — não reabrir sem motivo forte)

| Decisão | Escolha | Por quê |
|---|---|---|
| Build | **Vite** | dev server local rápido, `npm run build` gera pasta estática servível offline |
| UI | **React 18 + TypeScript** | ficha é CRUD reativo denso; derivados (`PV = base + 5×Vigor`) caem de graça; caminho de menor risco para construir rápido e certo |
| Estado | **Zustand + middleware `persist`** | localStorage automático, sem boilerplate, selectors evitam re-render da ficha inteira a cada tecla |
| Dados 3D | **`@3d-dice/dice-box-threejs`** (Three.js + cannon-es) | ver "Rolagem forçada" abaixo: escolhido por suportar resultado forçado nativo (`1d20@X`), necessário pro modo determinístico do mestre. É a lib menos mantida (2022), mas Three vem bundlada nela (sem conflito com nosso Three 0.169) |
| Tokens 3D | **cena Three.js própria, leve** (ver abaixo) | cena separada da dos dados. A dice-box-threejs bundla seu próprio Three; os tokens usam o Three 0.169 do projeto — duas instâncias, sem conflito (só um warning no console) |
| Fontes | **@fontsource** (Barlow, Barlow Condensed, IBM Plex Mono) | self-host, zero dependência de internet na sessão |
| Backend | **nenhum** | mestre único, screen share; `npm run dev` local ou `npx serve dist` |

## Rolagem: honesta por padrão + modo forçado do mestre (decisão revertida)

O plano original (e as primeiras versões deste doc) diziam "rolagem sempre honesta, nunca `1d20@X`". **O usuário reverteu isso**: quer poder forçar um resultado quando precisar, controlando de **fora** da janela compartilhada no Discord. Decisão atual:

- **Padrão: honesto.** UI monta o contexto do teste → `roll('1d20')` (física) → o motor soma modificadores, classifica → log. Física decide o dado; matemática decide o teste.
- **Exceção: forçado.** Se o mestre enfileirar valores pela **janela de controle** (`#controle`, janela separada), a próxima rolagem usa a notação `1d20@X` — a lib faz *swap da face* do dado depois que a física assenta, então o dado **cai fisicamente no valor** escolhido, indistinguível de uma rolagem honesta na tela.

Por que `dice-box-threejs` e não o `@3d-dice/dice-box` (Babylon) que usávamos até aqui: **só a versão threejs suporta `@` forçado nativo.** No Babylon, o valor vem de um raycast na face que a física assentou (`Dice.js` → `getRollResult`), e os dados rodam num web-worker offscreen com a cena encapsulada em campos privados — forçar exigiria forkar a lib. A versão threejs entrega isso de fábrica. Trade-off aceito pelo usuário: lib menos mantida (v0.0.12, 2022).

### Como o forçado flui (arquivos)

- [`src/dice/forcarRolagem.ts`](../../src/dice/forcarRolagem.ts) — canal via **BroadcastChannel** (`estatica-forcar-dados`). A janela de controle chama `enviarForcados(valores, umaVez)`; a principal chama `consumirForcados(totalDados)` no momento da rolagem. `umaVez` (padrão) força só a próxima e volta ao honesto; sync é bidirecional (as duas janelas mostram o mesmo estado).
- [`src/dice/useDiceBox.ts`](../../src/dice/useDiceBox.ts) — adapter: converte `RollTermo[]`/string → notação da lib, anexa `@v1,v2,...` se há força enfileirada, e **traduz o resultado da lib de volta pro shape `RollGroupResult[]`** que os quatro roladores já consumiam (evitou reescrever a UI). Valores forçados são o **valor bruto do dado**, um por dado na ordem da rolagem (a ficha soma os modificadores depois).
- [`src/features/controle/ControlPanel.tsx`](../../src/features/controle/ControlPanel.tsx) — a janela secreta (rota por hash `#controle`, aberta via `window.open` pelo botão "controle" no header). Mesma origin → BroadcastChannel conecta sem backend, funciona offline.

Validado ponta a ponta com duas janelas reais: força de 1 dado (teste → 1 natural), de 2 dados (surto 2d20 → 10/20), reversão automática após consumir, sem erros de console.

### API da lib (não publica tipos — decl. à mão em `src/dice/dice-box-threejs.d.ts`)

- Construtor **2 argumentos**: `new DiceBox('#seletor', { assetPath, theme_customColorset, ... })`.
- `initialize()` async **precisa ser chamado e aguardado** antes de rolar.
- `roll(notation)` → Promise com `{ notation, sets: [{ num, sides, rolls: [{value}], total }], modifier, total }`. Notação combinada suportada: `1d8+1d20`, forçada `1d8+1d20@5,15`.
- **Cor dos números**: `theme_customColorset.foreground` (aqui: âmbar `#ffc400`); `background` = corpo do dado (ciano `#2a6d78`). Sem precisar recolorir textura (era o problema do Babylon). Definido inline no `useDiceBox`.
- Assets (texturas envmap/superfícies + sons) em `node_modules/@3d-dice/dice-box-threejs/public/` → copiados p/ `public/assets/dice-box-threejs/` pelo [`scripts/copy-dice-assets.mjs`](../../scripts/copy-dice-assets.mjs) no `postinstall`. `assetPath: '/assets/dice-box-threejs/'`.
- Three vem **bundlada** na lib (não importa `three` externo) → sem conflito com nosso `three@0.169` dos tokens.

**Pendente do Dia 4** (herdado): a bandeja visual (`<div>`) ainda é maior que a área real de arremesso da física — reduzir a caixa ou ajustar escala quando desenhar a bandeja definitiva.

## Shell de abas e preservação de estado (sessão 18/07/2026)

- O bug de regressão identificado na navegação entre abas veio de renderização condicional de `App.tsx`: ao trocar de "Dados & Regras" para outra aba, o componente de dados era desmontado.
- Em React, isso faz o `useState` interno dos roladores (Surto, Trauma, Sanidade, rolagem livre) voltar ao valor inicial e também ativa o cleanup do hook de dados (`useDiceBox`), que `replaceChildren()` no container da bandeja — por isso o dado desaparecia.
- Correção aplicada: não remover o componente de uma aba do arbore; manter o painel montado e controlar apenas `display`/visibilidade no shell principal. Isso preserva o estado local da seleção e da mesa de dados sem mudar a lógica do motor.
- Efeito esperado e validado: ao voltar à aba de dados, as opções escolhidas e a bandeja continuam presentes. A correção foi confirmada com `npm run build` concluindo com êxito.

## Estrutura de pastas

```
src/
  app/            # shell, abas, atalhos de teclado, camada de ruído
  state/          # store zustand (slices: fichas, npcs, sessao, mapa, log) + schema + migrations
  rules/          # motor puro, sem UI: testes, sanidade, surto, trauma, iniciativa, dinheiro
  rules/data/     # tabelas do jogo tipadas: surto20, traumas20, armas, antecedentes, pericias15
  dice/           # wrapper da dice-box: fila de rolagens, colorsets rede/ruido, fallback 2D
  tokens3d/       # cena three dos tokens, loader .glb, fallback placa/crachá
  features/       # uma pasta por aba: sessao/, fichas/, dados/, mapa/, npcs/, log/
  styles/         # tokens.css, ruido.css, base.css
assets/faces/     # .glb ou foto por personagem (opcional, fora do bundle)
```

Regra de ouro: **`rules/` é TypeScript puro, sem imports de React ou Three** — testável com vitest, e é onde mora a fidelidade ao `regras.md`.

## Modelo de dados (resumo do shape persistido)

```ts
type Estado = {
  schemaVersion: number;          // migração explícita a cada mudança de shape
  sessao: { nome, numero, cenaAtual, clima, hora };
  fichas: Ficha[];                // ver ficha.md — inclui reguladores/acessos
  fichaAtivaId: string | null;    // controla o tier de ruído global
  npcs: Npc[];                    // nome, pv, defesa, notas, iniciativa
  iniciativa: EntradaIniciativa[];
  mapa: { imagemDataUrl, tokens: TokenPos[] };
  log: EntradaLog[];              // append-only, timestamp + tipo + payload
  config: { basePV: 10|20|30 };   // dial de letalidade
};
```

- Persistência: zustand/persist em localStorage, com `version` + `migrate`.
- **Export/Import JSON** obrigatório (botão "imprimir tudo"): localStorage é frágil (limpeza de navegador, perfil errado). Backup antes da sessão faz parte do checklist.
- Imagem do mapa como dataURL tem limite (~5MB localStorage) — comprimir via canvas para máx. ~1600px de largura na importação.

## Integração dice-box

- Container próprio na aba Dados; também um overlay compacto invocável de qualquer aba (rolar da ficha sem trocar de tela).
- Fila: uma rolagem por vez; inputs de rolagem desabilitados até `onRollComplete` (evita corrida no log).
- Dois colorsets registrados: `rede` (vidro ciano) e `ruido` (âmbar/vermelho sujo) — Sanidade e Surto sempre em `ruido`.
- **Fallback 2D**: se WebGL falhar ou a lib não inicializar, rolar com `crypto.getRandomValues` e animar o número em CSS. O jogo nunca pode travar por causa do 3D.
- Surto = duas rolagens de d20 em sequência na fila, resultados lado a lado; iguais → banner "o destino insiste".

## Tokens 3D sobre o mapa

- Mapa: `<img>` 2D + camada de tokens. Drag por pointer events em coordenadas normalizadas (0–1) — sobrevive a resize.
- Renderização: um `<canvas>` Three.js transparente sobre o mapa, câmera ortográfica; cada token é um mesh (cristal low-poly, ou `.glb` de `assets/faces/` se existir, ou placa com foto + shader scanline).
- Animação idle (rotação/flutuação) roda em um único rAF; **pausar quando a aba Mapa não está visível** e quando `document.hidden`.
- Corte barato pré-combinado: trocar a camada 3D por divs coloridas é uma mudança só em `tokens3d/` — a lógica de drag não muda.

## Performance (budget para screen share)

- 60fps ao arrastar token; rolagem de dados não pode travar a UI (dice-box já roda física fora do main thread na medida do possível; manter a bandeja com `devicePixelRatio` limitado a 1.5).
- Camada de ruído: só `transform`/`opacity`, tiers discretos via `data-ruido` no `<html>`, nenhum JS por frame.
- Log: virtualizar só se passar de ~500 entradas (não otimizar antes).

## Comandos

```bash
npm run dev      # desenvolvimento
npm run build    # gera dist/ estático
npx serve dist   # servir offline no dia da sessão (documentado no README)
npm test         # vitest sobre rules/
```
