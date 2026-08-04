# Plano — Régua de medição no mapa + combate mais fluido

> Documento técnico de implementação. Segue a arquitetura fechada do projeto (Zustand + React +
> Supabase Realtime, sem backend próprio) e o vocabulário de `arte.md`. Conferido contra o código
> em 03/08 — cada caminho e número de linha citado aqui foi verificado.

---

## Requisitos (o que foi pedido)

**Régua**
1. Medir distância entre células do grid, em metros ou quilômetros — como no Roll20.
2. Visível para todos os participantes, ao vivo.
3. Cor da régua = cor de quem está medindo.
4. A medição **some sozinha** alguns segundos depois de terminar.
5. A medição aceita **curvas** (waypoints), pra contornar obstáculos do mapa.

**Combate**
6. Controle mais fluido para o GM **e** para os jogadores.
7. O GM precisa decidir rápido com a informação de combate à vista.

---

## Decisões fechadas

| Questão | Decisão |
|---|---|
| Cor da régua do mestre (ele não tem personagem) | Cor fixa de mestre — `var(--rede)`, rótulo "mestre". Nunca a cor de uma ficha. |
| Diagonal | **Euclidiana**: 1 diagonal de célula = 2,1 m (√2 × 1,5). Coerente com as distâncias métricas de `regras.md` (9 m, 30 m). |
| Snap | Sempre no centro da célula, quando `grade.ativa`. Sem grade, medição livre. |
| Persistência da régua | Nenhuma. É efêmera — não entra no localStorage nem no export JSON. |
| Transporte | Supabase Realtime **broadcast**. Sem tabela, sem migração, sem RLS. |
| Escopo de combate no sprint 1 | Dano rápido + multi-alvo (C1) e painel do GM sempre à mão (C2), mais um ajuste pequeno do lado do jogador (C3). |

---

## Correções em relação à versão anterior deste documento

A versão anterior foi escrita sem conferir o código. O que mudou e por quê:

| Afirmação anterior | Realidade no repo |
|---|---|
| "`GradeOverlay` já é renderizado no `MapaTab` e no `MapaJogadorView`" | É um botão flutuante **só do GM** (`MapaTab.tsx:383`). O jogador nunca vê — não existe painel de grid do lado dele. |
| Tabela `reguas_mapa` + RLS + limpeza de réguas órfãs | Régua é efêmera (some em segundos). Tabela é overhead puro: migração, policy, linha órfã pra varrer. Broadcast resolve sem nada disso. |
| `reguas: ReguaMapa[]` dentro de `EstadoMapa` | `partialize: (state) => state` (`store.ts:861`) persiste **tudo** no localStorage e no export JSON. Régua efêmera não pode entrar aí. |
| Sync novo para escala/unidade do grid | `grade` inteira já sincroniza GM→jogador como jsonb (`mapaPublicoSync.ts:34`). Escala e unidade pegam carona de graça. |
| P0.4: "MORRENDO ③ → ② → ① → ☠", estabilizar em 3 rodadas | Regra inventada (é D&D, não Estática). `regras.md:55`: 0 PV = **fora de combate, caído, não morto**; sem socorro morre em minutos; Medicina DT 15 estabiliza; acorda com 1 PV no fim da cena. Sem contagem de rodadas. Reescrito na Fase 1 das fases seguintes. |
| Régua = uma linha reta `x1,y1 → x2,y2` | Não atende o requisito 5 (curvas). Agora é polilinha com waypoints. |
| Só "limpar todas as réguas" (botão manual) | Não atende o requisito 4. Agora expira sozinha. |
| `ConfigGridModal` + painel de régua para o jogador | UI a mais na tela de quem tem menos espaço. O jogador não configura nada — só mede e lê o rótulo. |

---

## PARTE 1 — Régua de medição ✅ implementada (04/08)

### 1.1 Modelo — efêmero, fora do store persistido

Arquivo novo: `src/state/reguasStore.ts` — Zustand **sem `persist`**.

```ts
export interface ReguaViva {
  id: string;                          // = autorId (uma régua viva por autor, sem acúmulo de rastros)
  autorId: string;                     // Ficha.id | 'mestre'
  cor: string;                         // corVisual da ficha, ou var(--rede) para o mestre
  pontos: { x: number; y: number }[];  // 0-1 relativo à IMAGEM — mesma base de TokenMapa e GradeMapa
  atualizadaEm: number;                // Date.now() LOCAL de quem renderiza — base do fade
  ativa: boolean;                      // true enquanto o autor ainda arrasta
}
```

Actions: `upsertRegua(regua)`, `removerRegua(id)`, `expirarAntigas(agora)`.

Por que fora do `useStore`: o store principal persiste o estado inteiro (`partialize: (state) => state`,
`store.ts:861`) — régua entraria no localStorage e no JSON de export, que é justamente o que viaja
entre máquinas (ver "portabilidade" em `CLAUDE.md`). Dado descartável não polui backup.

### 1.2 Utilitários puros

Em `src/features/mapa/mapaUtils.ts`, junto de `getImgRenderRect` / `retanguloGradeEmPx` / `retanguloConteudo`
(que já resolvem o letterboxing de `object-fit: contain` e são reusados aqui sem alteração):

```ts
/** Snap ao centro da célula. Sem grade ativa, devolve a posição crua (medição livre). */
centroDaCelula(x: number, y: number, grade: GradeMapa): { x: number; y: number }

/** Delta normalizado → delta em colunas/linhas → hypot. Euclidiana. */
distanciaEmCelulas(a: Ponto, b: Ponto, grade: GradeMapa): number

/** Soma dos segmentos da polilinha × grade.escala. */
distanciaTotal(pontos: Ponto[], grade: GradeMapa): number

/** pt-BR com vírgula decimal: "13,5 m", "1,2 km", "750 m". Minúsculas, sem exclamação (arte.md). */
formatarDistancia(valor: number, unidade: UnidadeMedida): string

/** Rótulo auxiliar: Deslocamento = 9 m (regras.md:177). Ex.: "1½ deslocamento". */
emDeslocamentos(metros: number): string
```

Célula não é necessariamente quadrada em pixels (`largura`/`altura` em % da imagem, `colunas`/`linhas`
independentes) — por isso a conta é feita em **contagem de células** (`dCol`, `dRow`), não em pixels.

### 1.3 Escala e unidade no grid

`GradeMapa` (`src/state/types.ts:255`) ganha dois campos:

```ts
escala: number;          // unidades por célula — default 1.5 (adjacência, regras.md:179/184)
unidade: 'm' | 'km';     // default 'm'
```

Mudanças que isso exige:
- `criarGradeInicial` (`factories.ts:81`) — defaults.
- `SCHEMA_VERSION` 19 → 20 (`factories.ts:135`) + bloco `migrate` preenchendo os defaults em grades antigas.
- Ramo de import JSON (`store.ts:815`) — `?? 1.5` / `?? 'm'`, mesmo padrão dos outros campos ali.
- `GradeOverlay.tsx` — dois campos novos no painel do GM (número + select), no mesmo `campos-grid`.

O jogador **não ganha painel**: recebe escala e unidade pela hidratação de `mapa.grade`
(`useHidratarMapaPublico`) e lê o valor no rótulo da própria régua. Se o GM mudar a escala no meio da
cena, os rótulos recalculam sozinhos — a régua nunca guarda metros, só pontos.

### 1.4 Interação

Hook compartilhado: `src/features/mapa/useRegua.ts` — mesma ideia de `useIniciativa.ts`, para não
duplicar a lógica entre `MapaTab` (GM) e `MapaJogadorView` (jogador).

```ts
useRegua({ autorId, cor, grade, containerRef, imgRef, bloqueado })
  → { onPointerDown, onPointerMove, onPointerUp, onContextMenu, onKeyDown }
```

1. `pointerdown` em área vazia da `.mapa-area` inicia a medição. A `<img>` é `pointer-events: none`
   (`mapa.css:66`), então o alvo do evento é o próprio container — token e alças do grid, que estão
   por cima, continuam com prioridade.
2. `pointermove` move o último ponto, com snap ao centro da célula.
3. **Waypoint**: botão direito (com `contextmenu` prevenido) ou tecla `w` fixa o ponto atual e abre um
   novo segmento. É isso que permite contornar obstáculos — requisito 5.
4. `pointerup` finaliza (`ativa: false`) e começa a contagem do fade. `Esc` cancela e remove na hora.

Coexistência com o que já existe:
- GM: `arrastoRef` (`MapaTab.tsx:66`) já distingue token / mover grade / alça — a régua só assume quando
  `arrastoRef.current === null`.
- Jogador: `arrastandoRef` (`MapaJogadorView.tsx:39`) marca o arrasto do próprio token — mesma trava.
- Ordem de captura, do mais específico ao mais genérico: token → alças do grid → régua.

### 1.5 Render e fade

`src/features/mapa/ReguaOverlay.tsx` — um `<svg>` cobrindo a `.mapa-area`, `pointer-events: none`,
`z-index: 3` (acima de `.mapa-token`, que é 2 em `mapa.css:94`; abaixo dos painéis flutuantes, que são 50).

Por régua:
- `<polyline>` tracejada, `stroke={regua.cor}` — requisito 3.
- Círculo em cada waypoint.
- Rótulo por segmento e total no ponto final, com `paint-order: stroke` para o halo ficar legível sobre
  qualquer mapa.

Fade (requisito 4): constantes `MS_ATE_SUMIR = 4000` e `MS_FADE = 600`. Um `setInterval(250)` no overlay
chama `expirarAntigas`; régua com `ativa: true` nunca expira (quem ainda está medindo não perde a linha).

**`atualizadaEm` é sempre o relógio local de quem renderiza**, nunca o timestamp que veio no payload:
relógios de máquinas diferentes não batem, e usar o remoto faria a régua do outro sumir cedo demais ou
nunca sumir.

CSS novo em `src/features/mapa/mapa.css`: `.mapa-regua-svg`, `.mapa-regua-linha`, `.mapa-regua-ponto`,
`.mapa-regua-rotulo`.

### 1.6 Sincronização

`src/multiplayer/reguasSync.ts` — **broadcast**, não tabela:

```ts
cliente.channel('reguas', { config: { broadcast: { self: false } } })
```

- Payloads: `{ tipo: 'regua', regua }` durante a medição e no final; `{ tipo: 'regua-fim', id }` no `Esc`.
- Throttle ~80 ms por id durante o arrasto, reusando `criarDebouncePorChave` (`src/multiplayer/debounce.ts`)
  — mesmo remédio que `tokensSync.ts:12` aplicou para a rajada de `pointermove`.
- Envio final garantido no `pointerup` (`ativa: false`), fora do throttle — sem ele, a última posição
  pode ficar pendurada.
- Ao receber: `upsertRegua` com `atualizadaEm: Date.now()` local (ver 1.5).
- Sem `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, `iniciarSyncReguas()` é no-op e a régua funciona
  local — o fallback GM-solo offline continua intacto.

Boot: uma linha em `App.tsx:127` e outra em `PlayerApp.tsx:83`, dentro do mesmo
`iniciarAuthMultiplayer().then(...)` dos demais syncs, com o cleanup correspondente.

**Por que broadcast e não tabela**: a régua vive 4 segundos. Uma tabela exigiria migração, policy de RLS,
`alter publication supabase_realtime`, e uma rotina de varredura de linhas órfãs — tudo para guardar dado
que ninguém quer de volta. Broadcast entrega o mesmo alcance (todos os clientes conectados) com zero
superfície de banco. É o primeiro uso de broadcast no projeto; se o Realtime Authorization do projeto vier
a exigir canal privado, o ajuste é uma opção no `channel()`, não uma mudança de desenho.

### 1.7 Testes (`npm test` antes de qualquer navegador)

- `src/features/mapa/mapaUtils.test.ts` — snap ao centro (ida e volta), `distanciaTotal` com e sem
  waypoints, escalas 1,5 / 5 / 0,5, formatação m e km em pt-BR, célula não quadrada.
- `src/state/reguasStore.test.ts` — `expirarAntigas` respeita `ativa` e o limiar; `upsertRegua` substitui
  a régua do mesmo autor em vez de acumular.

### 1.8 Riscos

| Risco | Mitigação |
|---|---|
| Régua brigando com o arrasto de token / alças do grid | Trava por `arrastoRef` / `arrastandoRef`; SVG com `pointer-events: none`. |
| Coordenada errada com imagem letterboxed | Reusar `getImgRenderRect` + `retanguloConteudo`, já testados em produção (fix do gridline, 25/07). |
| Relógios dessincronizados entre máquinas | `atualizadaEm` sempre local. |
| Broadcast bloqueado por Realtime Authorization | Detectável no primeiro teste com 2 abas; ajuste é uma opção no `channel()`. |
| Grid desligado | Medição livre, sem snap — o rótulo continua correto porque a escala é por célula. |

---

## PARTE 2 — Combate ✅ implementada, sprint 1 + todas as fases seguintes (04/08)

### Sprint 1 ✅

#### C1 · Dano rápido e multi-alvo
`src/features/iniciativa/IniciativaPanel.tsx` + `src/hooks/useIniciativa.ts`

- Linha de botões `−10 −5 −1 | +1 +5` no card, usando o `pv.aplicar` que `pvDoCombatente`
  (`useIniciativa.ts:109`) já expõe — hoje só existem `−`/`+` de 1 em 1 (`IniciativaPanel.tsx:248`).
- Campo numérico livre com Enter para aplicar: o dano real vem da rolagem, raramente é 5 redondo.
- Seleção múltipla: checkbox no card + barra fixa no rodapé do painel —
  `aplicar a N: [dano] [aplicar] [condição ▼]`. Itera a seleção chamando `pv.aplicar` e
  `alternarCondicaoCombate`. Granada em 4 alvos vira 1 clique em vez de 40.
- Log agregado: uma entrada só ("dano em área — Pol1, Pol2, Pol3: −7 PV"). `registrarLog` já está no
  hook (`useIniciativa.ts:47`), falta expor no `return`.
- Fidelidade a `regras.md:197` ("não existe cura em combate"): os botões `+` são rotulados **ajuste**,
  não cura — servem para corrigir erro de digitação, não para curar.

#### C2 · Painel do GM sempre à mão
`src/features/mapa/CombatOverlay.tsx`

- Cabeçalho fixo com o que decide o turno: `rodada N · vez de <nome> · próximo: <nome>` e o botão
  "próximo" em destaque. Hoje o cabeçalho mostra só "combate · rodada N" (`CombatOverlay.tsx:91`).
- Auto-scroll do painel para o card ativo ao avançar turno (`scrollIntoView({ block: 'nearest' })`) — o
  card ativo já expande sozinho (`IniciativaPanel.tsx:94`), mas some da vista em listas longas.
- Atalhos de teclado: `espaço` e `n` avançam o turno quando `modoCombate` está ligado e o foco não está
  num input. Os dígitos 1–7 já são das abas (`App.tsx:27`); espaço e `n` estão livres.
- Badge "crítico" quando PV ≤ 25% do máximo — o limiar já existe em `corPv` (`useIniciativa.ts:17`), só
  não vira rótulo. O GM enxerga quem está por um fio sem abrir card nenhum.

#### C3 · Fluidez do lado do jogador
`src/features/iniciativa/CombateJogadorView.tsx`

- Banner "sua vez" destacado e o painel de combate abrindo sozinho quando o turno vira para o jogador.
  Hoje o card dele só ganha borda (`CombateJogadorView.tsx:64`) e o painel pode estar fechado.

### Fases seguintes — status: ✅ todas implementadas (04/08)

1. ✅ **Fora de combate a 0 PV**, com as regras certas (`regras.md:55`, `84`, `189`): badge "fora de
   combate"/"estável", botão "estabilizar — Medicina (Intelecto) DT 15" com seletor de socorrista
   (`rules/combate.ts::resolverEstabilizar`, `useIniciativa.ts::tentarEstabilizar`), condição `estavel`
   nova em `condicoesCombate.ts`; e aviso automático (log tipo `sanidade`) de teste de Sanidade 1d4 pra
   quem viu o aliado cair, disparado na transição >0→0 PV dentro de `pvDoCombatente().aplicar`.
   "Acorda com 1 PV no fim da cena" continua manual (o mestre aplica quando a cena de fato termina — não
   automatizado, mesmo espírito de condição-como-lembrete do resto do app). Substitui o antigo P0.4, que
   inventava contagem de rodadas de morte.
2. ✅ Duração de condições com auto-expiração — `sessaoPublica.condicaoDuracao` (schema v21, migração +
   coluna nova `condicao_duracao` em `sessao_publica`, `supabase/migrations/0015_condicao_duracao.sql`).
   `decrementarDuracoesCombate` (rules/combate.ts) roda dentro de `avancarTurno`, decrementando a
   duração de quem ACABOU de jogar; chega a 0, some sozinha de `condicoesCombate` também. Campo de
   rodadas (vazio = manual/persistente, igual sempre foi) aparece ao lado de cada chip ativo.
3. 🟡 Rerrolar iniciativa de um combatente — ✅ feito (`rerolarIniciativaDe`, botão 🎲 por card).
   Adiar — ✅ feito, mas **sem** o badge dedicado do rascunho original: reusa `reordenarIniciativa`
   (move pro fim da rodada) + a condição `aguardando` (mesmo mecanismo de `estavel`). **Preparar ação**
   e **iniciativa em grupo pra NPCs iguais** ficaram de fora — `regras.md` não tem mecânica de
   "ação preparada/gatilho", seria inventar regra (mesmo problema do P0.4 original); "grupo" é só QoL,
   sem valor de rodada/regra em jogo, adiado por escopo.
4. 🟡 Template de área de efeito — ✅ **Círculo e Quadrado** (`AoEOverlay.tsx`, `aoeGeometria.ts`,
   reusa a mesma noção de "célula" da régua). **Cone e Linha ficaram de fora** — exigem matemática de
   ângulo/segmento que não coube neste corte. Ferramenta GM-only, sem sync multiplayer (é cálculo de
   dano, não algo que o jogador precise ver) — lista quem está dentro, aplica dano em 1 clique.
5. ✅ Log de combate filtrado (`CombatLogView.tsx`, filtra `dano`/`iniciativa`/`teste`, com filtro por
   combatente) e resumo exportável (`gerarResumoCombate`, botão "📋 resumo" copia markdown). **Sem**
   "recursos gastos"/"XP" do rascunho original — o app não rastreia munição nem progressão, incluir
   essas linhas seria inventar dado que não existe. **Sem** filtro "por rodada" — `EntradaLog` não
   carrega rodada, só timestamp; adicionar esse campo ficou fora deste corte.

Testes: `src/rules/combate.ts` tem 24 testes (`combate.test.ts`) cobrindo estabilizar, duração e
resumo; `src/features/mapa/aoeGeometria.ts` tem 9 (`aoeGeometria.test.ts`); `rerolarIniciativaDe` tem
3 em `store.test.ts`. Suíte completa: 236 testes, `npm run build` limpo.

---

## Gates

| Gate | Como | Critério |
|---|---|---|
| Tipos | `npm run build` | compila sem erro |
| Regras e utilitários | `npm test` | todos passam |
| GM | `npm run dev` → `/mesa-estatica/` | mede, faz waypoint, some sozinha; escala e unidade no painel do grid |
| Jogador | `/mesa-estatica/jogador.html` | mede na cor da própria ficha, lê a distância na unidade do GM |
| Sync | 2 abas medindo ao mesmo tempo | cada um vê a régua do outro, na cor certa, sumindo sozinha |
| Persistência | recarregar a página | régua **não** volta (é o esperado); escala e unidade voltam |
| Clone limpo | `git clone && npm i && npm run dev` | funciona sem configuração extra |

---

## O que não fazer

- Hardcodar `1,5` — sempre `grade.escala` + `grade.unidade`.
- Guardar régua no store persistido (localStorage / export JSON).
- Criar tabela no Supabase para dado efêmero.
- Inventar regra que não está em `.claude/docs/regras.md` — se o app e as regras divergirem, o app está
  errado.
- Dar painel de configuração ao jogador: ele mede e lê, não configura.
- Quebrar o fallback GM-solo offline: sem env vars, tudo continua local.

---

## Referências de código (conferidas)

| O quê | Onde |
|---|---|
| Utilitários de grid e letterboxing | `src/features/mapa/mapaUtils.ts` |
| Mapa do GM (arrasto, alças, grade) | `src/features/mapa/MapaTab.tsx` |
| Mapa do jogador | `src/features/mapa/MapaJogadorView.tsx` |
| Painel do grid (só GM, flutuante) | `src/features/mapa/GradeOverlay.tsx` |
| Sync da grade e imagem (jsonb) | `src/multiplayer/mapaPublicoSync.ts` |
| Padrão de sync com throttle | `src/multiplayer/tokensSync.ts`, `src/multiplayer/debounce.ts` |
| Tipos de mapa e grade | `src/state/types.ts:135-272` |
| Schema, defaults e migração | `src/state/factories.ts`, `src/state/store.ts` |
| Lógica de iniciativa (PV, Defesa, condições) | `src/hooks/useIniciativa.ts` |
| Painel de iniciativa compartilhado | `src/features/iniciativa/IniciativaPanel.tsx` |
| Combate visto pelo jogador | `src/features/iniciativa/CombateJogadorView.tsx` |
| Condições de combate | `src/rules/data/condicoesCombate.ts` |
| Distâncias, 0 PV, DT 15 | `.claude/docs/regras.md:55, 84, 175-197` |

---

*Documento vivo — atualizar conforme a implementação avança.*
