# Estática — Arquitetura Técnica

## Decisões (fechadas — não reabrir sem motivo forte)

| Decisão | Escolha | Por quê |
|---|---|---|
| Build | **Vite** | dev server local rápido, `npm run build` gera pasta estática servível offline |
| UI | **React 18 + TypeScript** | ficha é CRUD reativo denso; derivados (`PV = base + 5×Vigor`) caem de graça; caminho de menor risco para construir rápido e certo |
| Estado | **Zustand + middleware `persist`** | localStorage automático, sem boilerplate, selectors evitam re-render da ficha inteira a cada tecla |
| Dados 3D | **`@3d-dice/dice-box`** (Babylon.js + Ammo.js) | ver "Correção — biblioteca de dados" abaixo: a lib do plano original está abandonada |
| Tokens 3D | **cena Three.js própria, leve** (ver abaixo) | a dice-box roda a própria stack (Babylon) isolada num worker — não dá pra "reaproveitar a mesma cena" nem no sentido do plano original (Three) nem tecnicamente (motores diferentes). Tokens usam Three.js numa cena separada |
| Fontes | **@fontsource** (Barlow, Barlow Condensed, IBM Plex Mono) | self-host, zero dependência de internet na sessão |
| Backend | **nenhum** | mestre único, screen share; `npm run dev` local ou `npx serve dist` |

## Correção importante: rolagem honesta vs. determinística

O plano original se contradizia — a seção dos dados pedia física 100% honesta e a seção do motor de regras pedia "resultado calculado passado como valor determinístico pro dado 3D". **Decisão: rolagem honesta.**

Fluxo: UI monta o contexto do teste (atributo, perícia, DT, Ferido) → dispara `roll('1d20')` **sem** notação de resultado forçado → `onRollComplete` devolve o valor bruto da física (agrupado por `getRollResults()`) → o motor soma modificadores, classifica (sucesso/falha/margem 10+/20 nat/1 nat) → grava no log. Física decide o dado; matemática decide o teste.

## Correção — biblioteca de dados: dice-box, não dice-box-threejs (achado do spike Dia 1)

O plano original recomendava `@3d-dice/dice-box-threejs` (Three.js + Cannon-es). Checagem no npm registry no Dia 1 mostrou que essa lib está em **v0.0.12, com último publish em outubro/2022** — abandonada. A lib irmã do mesmo time, **`@3d-dice/dice-box`**, está em **v1.1.4 (última: agosto/2024, 52 releases)** e é a mantida ativamente — mas usa **Babylon.js + Ammo.js**, não Three.js/Cannon. Trocamos para ela. Consequências:

- Os tokens (seção 4.2) continuam em Three.js — engines diferentes, mas isso já não muda nada porque os tokens sempre iam precisar de cena própria (ver linha acima).
- **A lib não publica tipos TypeScript.** Declaração ambiente mínima escrita à mão em [`src/dice/dice-box.d.ts`](../../src/dice/dice-box.d.ts), derivada de ler o bundle `dist/dice-box.es.js` diretamente (não confiar cegamente no README do GitHub — ver próximo ponto).
- **Construtor é 1 argumento só**: `new DiceBox({ container: '#id', assetPath: '/assets/dice-box/', ... })`. O README do GitHub mostra `new DiceBox('#id', {...})` (2 argumentos) — **isso não bate com o código-fonte instalado da v1.1.4**. Confiar no código, não no README.
- **`roll(notation)` resolve com um array plano de dados individuais**, não agrupado. Para ler o resultado somado/agrupado (o que a UI precisa: valor total do teste), usar o callback `box.onRollComplete = (results) => ...`, que recebe `getRollResults()` já agrupado por dado/grupo com `{ qty, value, sides, rolls: [...] }`. Isso importa especialmente pro Surto (seção 7 de `regras.md`), que rola 2×d20 em paralelo — `onRollComplete` dispara uma vez com os dois grupos prontos.
- **Assets não são copiados automaticamente.** O `postinstall` da lib (`copyAssets.js`) é interativo (pede o caminho num prompt de terminal) e ficou bloqueado pelo `npm allow-scripts` neste ambiente. Copiar manualmente uma vez: `node_modules/@3d-dice/dice-box/dist/assets/*` → `public/assets/dice-box/`. Documentado no README do projeto (Dia 7).
- Validado no spike: **10 rolagens consecutivas** cobrindo d4, d6, d8, d10, d12, d20 (×3), d100 e 2d8 — todas com física honesta (valores variados, sem repetição suspeita), zero erros de console, todos os assets em 200 OK. Renderiza via OffscreenCanvas + web worker (bom para performance em screen share).

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
