# DeepSeek — mudanças nesta sessão

Todas as alterações abaixo são do assistente DeepSeek. O histórico do Claude está no `git log` e `ROADMAP.md`.

---
## Sessão 21/07/2026 — 4 commits

---

## 1. Refatoração da iniciativa + NPCs no ControlPanel + DT mínima 1

**Commits**: `8a946a7`

**Motivo**: a lógica de iniciativa/combate estava duplicada entre `CombatOverlay.tsx` e `NpcsTab.tsx` (~400 linhas cada), dificultando manutenção e gerando inconsistências.

### Extraída lógica para hook compartilhado
**Arquivos**: `src/hooks/useIniciativa.ts` (novo, +181 linhas), `src/features/iniciativa/IniciativaPanel.tsx` (novo, +281 linhas)
- Toda lógica de PV, Defesa, seleção, drag-and-drop, ações de NPC e controle de turno centralizada no hook
- `IniciativaPanel.tsx` renderiza o painel completo, consumido por `CombatOverlay` e `NpcsTab`
- Prop `podeArrastar` para habilitar/desabilitar drag-and-drop por contexto

### CombatOverlay e NpcsTab enxugados
**Arquivos**: `src/features/mapa/CombatOverlay.tsx` (-434 linhas), `src/features/npcs/NpcsTab.tsx` (-439 linhas)
- Todo o código de iniciativa removido e substituído por `<IniciativaPanel hook={iniciativa} />`
- CombatOverlay manteve só o wrapper de arrasto do painel flutuante + botão toggle

### ControlPanel agora aceita NPCs
**Arquivo**: `src/features/controle/ControlPanel.tsx`
- `const npcs = useStore((s) => s.npcs)` adicionado
- Dropdown de alvo agora lista também NPCs (antes só fichas de personagem)
- Função `nomeDoAlvo` busca tanto em `fichas` quanto em `npcs`

### Merge de estado da fila de forçados
**Arquivo**: `src/dice/forcarRolagem.ts`
- Fila de forçados migrada de Zustand para `assinar`/`filaAtual` do módulo como fonte primária
- Merge na sincronização BroadcastChannel: `fila = [...msg.fila, ...fila]` (itens da outra janela vêm primeiro)

### DT da cena não aceita zero
**Arquivo**: `src/features/sessao/sections/CenaAtualSection.tsx`
- `Number(e.target.value) || 0` → `Math.max(1, Number(e.target.value) || 1)`

### Bugs encontrados e corrigidos

| Bug | Sintoma | Causa | Correção |
|---|---|---|---|
| DT zero na cena | Dificuldade customizada zerava ao apagar o campo | `Number('') \|\| 0` → 0 | `Math.max(1, ...)` |
| Duplicação de código de iniciativa | Mesma lógica em 2 arquivos, risco de divergência | Refatoração postergada | Hook + componente compartilhado |
| ControlPanel sem NPCs | Mestre não podia forçar rolagem para NPCs | NPCs não estavam no escopo do controle | Adicionado `npcs` ao store + lookup |

---

## 2. Centralização da descricaoResultado + log duplicado de sanidade

**Commit**: `2f1d196`

**Motivo**: `descricaoResultado()` estava duplicada em `RoladorTeste.tsx` e `QuickRollOverlay.tsx` com lógica idêntica. Log de sanidade no store chamava `registrarLog` duas vezes.

### descricaoResultado movida para rules/
**Arquivos**: `src/rules/teste.ts`, `src/features/dados/RoladorTeste.tsx`, `src/features/dados/QuickRollOverlay.tsx`
- Função `descricaoResultado(r: ResultadoTeste): string` exportada de `teste.ts`
- Roladores agora importam de `teste.ts` em vez de terem implementação própria
- Testes unitários adicionados em `teste.test.ts` (4 cenários: 1 natural, 20 natural, margem 10+, sucesso/falha)

### Partialize escolhaSurtoPendente
**Arquivo**: `src/state/types.ts`
- `escolhaSurtoPendente` no store parcializado para aceitar `null` e evitar crashes em renderizações condicionais

### Log duplicado de sanidade removido
**Arquivo**: `src/state/store.ts`
- `ajustarSanidadeAtual` chamava `registrarLog('sanidade', ...)` duas vezes em certos fluxos
- Removida chamada redundante

### Bug encontrado

| Bug | Sintoma | Causa | Correção |
|---|---|---|---|
| Log duplicado de sanidade | Entradas repetidas no log ao ajustar Sanidade | Store chamava `registrarLog` duas vezes no mesmo path | Removida chamada extra |
| descricaoResultado duplicada | Strings de resultado inconsistentes entre roladores | Cópia da mesma lógica em 2 componentes | Centralizada em `rules/teste.ts` |

---

## 3. Surto vira array + migrations + guards de array

**Commit**: `8b19032`

**Motivo**: a ficha tinha `surtoAtivo: number | null` + `surtoEscolha: string | null`, que suportava apenas UM surto por vez. Regras permitem múltiplos surtos acumulados (ex.: perder 5+ de sanidade duas vezes na mesma cena). Além disso, dados corrompidos do localStorage (arrays `undefined`) quebravam a UI.

### surtoAtivo/surtoEscolha → surtosAtivos[]
**Arquivos**: `src/state/types.ts`, `src/state/factories.ts`, `src/state/store.ts`
- Novo tipo: `SurtoAtivo { id: string; expiraEm: number; escolha: string | null }`
- `Ficha.surtosAtivos: SurtoAtivo[]` substitui `surtoAtivo + surtoEscolha`
- `personagemEstaEmSurto` em `rules/surto.ts` agora recebe `SurtoAtivo[]` (faz `.some()`)
- `avancarCena()` limpa `surtosAtivos` de todas as fichas (antes limpava por ficha individual)

### Migrations v10→v11→v12
**Arquivo**: `src/state/store.ts`
- v10→v11: `surtoAtivo` + `surtoEscolha` → `surtosAtivos: []`
- v11→v12: deduplica `surtosAtivos` por `id` (remove duplicatas de migrações anteriores)
- `SCHEMA_VERSION` 10 → 12

### Guards ?? [] em campos de array
**Arquivos**: `src/state/store.ts`, `src/features/npcs/NpcsTab.tsx`, `src/features/dados/RolagemLivre.tsx`
- `ajustarSanidadeAtual`: `...(ficha.surtosAtivos ?? [])`
- `resolverEscolhaSurtoPendente`: `(ficha.surtosAtivos ?? []).map(...)`
- `avancarCena`: `(ficha.surtosAtivos ?? []).filter(...)`
- `registrarRoll`: `(s.rollsLog ?? [])` para o reducer
- `alternarCondicaoCombate`: `s.sessaoPublica.condicoesCombate ?? {}`
- NPCs: null guards em `acoes ?? []`

### Store tests (store.test.ts)
**Arquivo**: `src/state/store.test.ts` (novo, +270 linhas)
- `avancarCena`: incrementa contador, limpa surtos, não quebra se surtosAtivos undefined
- `ajustarSanidadeAtual`: não negativa, não ultrapassa máxima, dispara surto com perda ≥5, cria escolha pendente se d20 diferem, cria escolha direta se d20 iguais, incrementa estatística
- `resolverEscolhaSurtoPendente`: atualiza escolha, não duplica entradas, limpa pendente, não quebra se sem pendente
- `migrate`: v8→v9 adiciona acoes:[], v10→v11 converte surto, v11→v12 deduplica
- `campos de array undefined/null`: 7 testes para surtosAtivos, acoes, rollsLog, condicoesCombate

### Bugs encontrados e corrigidos

| Bug | Sintoma | Causa | Correção |
|---|---|---|---|
| Apenas 1 surto por ficha | Perder 5+ de sanidade 2x na mesma cena sobrescrevia o surto anterior | `surtoAtivo: number \| null` (campo único) | `surtosAtivos: SurtoAtivo[]` (array) |
| UI quebrava com dados corrompidos | Tela preta ao importar JSON de schema antigo | `[undefined].map()` ou `.filter()` em arrays não inicializados | Guards `?? []` em todo acesso a arrays no store |
| CondicoesCombate undefined | Tela preta no CombatOverlay | Schema antigo sem o campo `condicoesCombate` | Null guard `?? {}` no acesso |
| Duplicatas de surto após migração | Mesmo surto aparecendo 2x após schema bump | Migração v10→v11 adicionava sem verificar duplicatas | v11→v12 deduplica por id |

---

## 4. Atalho R, rolarAtualRef, armas como badges, forcarRolagem.test.ts

**Commit**: `3fa4542`

**Motivo**: atalho `R` não rolava o dado sozinho ao abrir o overlay; QuickRollOverlay com stale closure no `rolarAtualRef`; armas na ficha podiam ser roladas direto como badges; forcarRolagem sem testes unitários.

### Atalho R agora abre E rola
**Arquivo**: `src/app/App.tsx`
- `setAba('dados')` removido do handler de `R` (não troca mais de aba)
- `setOverlayAberto(true)` + `setPedidosRolagemRapida((n) => n + 1)` — abre e já dispara a rolagem

### rolarAtualRef contra stale closure
**Arquivo**: `src/features/dados/QuickRollOverlay.tsx`
- `rolarAtualRef = useRef(rolar)` — ref sincronizada via `useEffect` para evitar closures obsoletas
- Rolagem passa a chamar `rolarAtualRef.current(...)` em vez de `rolar(...)` diretamente
- **Bug**: o `useCallback(rolar, [ready])` no pai (`DadosTab`) só era atualizado quando `ready` mudava — entre a abertura do overlay e o clique em "rolar", o closure de `ready` podia estar desatualizado

### Armas da ficha viram badges roláveis
**Arquivo**: `src/features/mapa/TokenOverlay.tsx`
- Seção "ARMAS" redesenhada: cada arma como badge com nome e dano, clique rola o dano
- Rola `dano formula` (ex.: `2d6`, `1d4+Vigor`) via `rolarDano(danoFormula)` do hook
- Resultado logado como `rolagem-livre` com nome da arma e do personagem
- Layout: `display: flex` com `flexWrap: 'wrap'` + gap

### Testes do forcarRolagem
**Arquivo**: `src/dice/forcarRolagem.test.ts` (novo, +62 linhas)
- `consumirForcados` sem alvo: retorna valores na ordem
- `consumirForcados` com personagem específico: só consome se ID bater
- `consumirForcados` sem entrada correspondente: retorna `null`
- `consumirForcados` com menos valores que dados: repete o último valor
- `consumirForcados` com mais valores que dados: corta no `totalDados` (teste de preenchimento)

### IniciativaPanel — null safety e scroll
**Arquivo**: `src/features/iniciativa/IniciativaPanel.tsx`
- Labels de determinação no `TokenOverlay` agora mostram "nível {n}"
- Scrollbar na lista de combatentes quando ultrapassa a altura do painel

### Bug encontrado

| Bug | Sintoma | Causa | Correção |
|---|---|---|---|
| Tecla R não rolava | Overlay abria mas dado não rolava sozinho | Closure obsoleto de `rolar` entre renderizações | `rolarAtualRef` sincronizado via `useEffect` |
| Armas sem rolagem direta | Mestre precisava anotar dano e rolar separado | UX incompleta nas armas | Badges com clique que rola fórmula de dano |
| forcarRolagem sem testes | Refatoração podia quebrar sem detecção | Ausência de cobertura | Testes unitários com 5 cenários |

---

## Resumo de arquivos tocados (sessão 21/07)

| Arquivo | Mudanças |
|---|---|
| `src/hooks/useIniciativa.ts` | +181 linhas — hook centralizado de iniciativa |
| `src/features/iniciativa/IniciativaPanel.tsx` | +328 linhas — componente compartilhado + null safety |
| `src/features/mapa/CombatOverlay.tsx` | -434 linhas — duplicação substituída por IniciativaPanel |
| `src/features/npcs/NpcsTab.tsx` | -439 linhas — idem |
| `src/state/store.ts` | surto → array, ?? [], migrations v10→12 |
| `src/state/types.ts` | SurtoAtivo[] adicionado |
| `src/state/factories.ts` | SCHEMA_VERSION 10→12 |
| `src/state/store.test.ts` | +270 linhas — testes de store, migrate, arrays |
| `src/features/controle/ControlPanel.tsx` | NPCs como alvo de rolagem forçada |
| `src/dice/forcarRolagem.ts` | assinar/filaAtual + merge BroadcastChannel |
| `src/dice/forcarRolagem.test.ts` | +62 linhas — testes do módulo |
| `src/features/sessao/sections/CenaAtualSection.tsx` | DT mín 1 |
| `src/rules/teste.ts` | descricaoResultado centralizada |
| `src/rules/teste.test.ts` | +4 testes de descricaoResultado |
| `src/rules/surto.ts` | personagemEstaEmSurto → array |
| `src/rules/surto.test.ts` | Testes atualizados para array |
| `src/features/mapa/TokenOverlay.tsx` | Armas como badges, label nível {n} |
| `src/features/dados/QuickRollOverlay.tsx` | rolarAtualRef contra stale closure |
| `src/app/App.tsx` | Atalho R abre e rola sem trocar aba |

---
## Sessão 20/07/2026

**Motivo**: se `npc.acoes` fosse `undefined` em runtime (ex.: import de JSON de schema anterior), `[...npc.acoes]` lançava `TypeError: npc.acoes is not iterable`, o save silenciava sem fechar o editor.

**Arquivos**: `src/features/npcs/NpcsTab.tsx`
- `salvarNovaAcao`: `[...npc.acoes, ...]` → `[...(npc.acoes ?? []), ...]`
- `salvarAcao`: `npc.acoes.map(...)` → `(npc.acoes ?? []).map(...)`
- `removerAcao`: `npc.acoes.filter(...)` → `(npc.acoes ?? []).filter(...)`

**Arquivos**: `src/state/store.ts`
- `importarJSON`: normaliza NPCs importados com `acoes: n.acoes ?? []`

---

## 2. Bônus de ação de NPC flui para os roladores

**Motivo**: os bônus definidos nas ações do NPC (`NpcAcao.bonus`) não eram acessíveis nas interfaces de rolagem.

### QuickRollOverlay
**Arquivo**: `src/features/dados/QuickRollOverlay.tsx`
- Adicionados botões pill de ação (nome + bônus) abaixo do input manual de bônus, quando um NPC com ações está selecionado
- Clique numa ação preenche o `bonus` state com o valor da ação
- Funciona tanto no modo "simples" quanto "perícia" (compartilham o mesmo `bonus` state)

### RoladorTeste (Rolagem livre)
**Arquivo**: `src/features/dados/RoladorTeste.tsx`
- Já tinha o mecanismo de pills de ação desde implementação anterior — nenhuma mudança necessária

---

## 3. Resultado "simples" no QuickRollOverlay mostra breakdown

**Motivo**: no modo simples, o resultado era só o número total (`15`). Para NPC com bônus, o usuário queria ver a soma detalhada (`1D20=13 + 2 = 15`).

**Arquivo**: `src/features/dados/QuickRollOverlay.tsx`
- `resultado` state mudou de `number | null` para `{ d20: number; bonus: number; total: number } | null`
- `rolarSimples()` armazena o breakdown (d20, bonus, total)
- Display condicional: se `bonus !== 0`, mostra `1D20={d20} +{bonus} = {total}`; senão, mostra só o total (PC sem bônus não polui)

---

## 4. Aparência dos chips de ação NPC (vermelho sujo)

**Motivo**: os chips de ação usavam `combate-chip--ativa` (ciano `#4fc1d4`), parecendo toggles selecionados. O usuário pediu vermelho sujo (`--ruido`, `#a8463e`) sem vazar para outros elementos.

**Arquivos**: `src/features/npcs/NpcsTab.tsx`, `src/features/mapa/TokenOverlay.tsx`, `src/features/mapa/CombatOverlay.tsx`
- Classe alterada de `combate-chip combate-chip--ativa` para `combate-chip`
- Estilo inline adicionado: `borderColor: 'var(--ruido)'`, `color: 'var(--ruido)'`, `background: color-mix(in srgb, var(--ruido) 12%, transparent)`
- O CSS `.combate-chip` (borda `--concrete-2`) não foi modificado — zero vazamento

**Importante**: este foi o resultado final após 2 tentativas descartadas (primeiro tentou-se modificar o CSS `.combate-chip` global, o que vazou para todos os chips; depois reverteu-se).

---

## 5. Bônus no display da Rolagem Livre

**Motivo**: ao rolar dados combinados (ex.: `2d20`) para NPC com bônus, o display mostrava só os dados crus (`2d20 → 28 [13, 15] · total 28`) sem o bônus, dando a impressão de que o bônus não foi somado.

**Arquivo**: `src/features/dados/RolagemLivre.tsx`
- Adicionado `totalComBonus = totalGeral + bonus` para NPC
- Display agora mostra ` + {bonus} = {totalComBonus}` quando `bonus !== 0`

---

## 6. Grid da aba NPC muda para 2 colunas fixas

**Motivo**: o grid responsivo `repeat(auto-fill, minmax(260px, 1fr))` gerava coluna única em janelas estreitas, desperdiçando espaço lateral no painel do mestre. `repeat(2, 1fr)` garante 2 colunas sempre.

**Arquivo**: `src/features/npcs/NpcsTab.tsx`
- `gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))'` → `'repeat(2, 1fr)'`

---

## 7. TokenOverlay — layout de defesa + ações na mesma linha

**Motivo**: a `🛡 defesa` ficava numa linha própria acima das ações, ocupando espaço vertical desnecessário. Movida para a mesma flex row dos chips de ação.

**Arquivo**: `src/features/mapa/TokenOverlay.tsx`
- Span de defesa e botões de ação agora num único `display: flex` com `flexWrap: wrap`
- Removeu o `div` separado com `marginBottom: '0.5rem'` que isolava a defesa

---

## Sessão 22/07/2026 — Documentação

Alinhamento da documentação do projeto com o estado real do código após os 4 commits da sessão 21/07.

### README — seções novas e correções

**Arquivo**: `README.md`
- Adicionada seção **Abas** (`Atalho`, `Fichas`, `NPCs`, `Combate`, `Dados`, `Itens`, `Sessão`)
- Adicionada seção **Atalhos de Teclado** (`D`, `R`, `F`, `M`, `I`, `N`, `Esc`)
- Adicionada seção **Janela de Controle** (rolagem forçada, fila, BroadcastChannel)
- Adicionada seção **Sistema de Ruído** (ruído ambiente, motor, `playAudio`)
- `npx serve dist` corrigido para `npm run preview` (2 ocorrências)
- Adicionado link para `ficha.md`

### ROADMAP — entrada da refatoração

**Arquivo**: `ROADMAP.md`
- Adicionada entrada **"Refatoração iniciativa 21/07"** com mark completo
- `npx serve dist` corrigido para `npm run preview` (2 ocorrências)

### CLAUDE — expandido com features atuais

**Arquivo**: `CLAUDE.md`
- `state/` documentado com store, factories, types, migrations
- `features/` documentado com dados, fichas, iniciativa, mapa, npcs, controle, sessão
- `hooks/useAudio.ts` + `hooks/useRuido.ts` + `hooks/useIniciativa.ts`
- `rules/` documentado com `data/`, `teste.ts`, `surto.ts`, `pericias.ts`
- `descricaoResultado` centralizada
- `surtosAtivos[]` no lugar de `surtoAtivo`
- `RolagemLivre` modo `'nenhum'`
- Comandos: `npm run preview` + `npm run test:watch`

### DeepSeek.md — documentação dos 4 commits

**Arquivo**: `DeepSeek.md`
- Adicionada sessão **21/07/2026 — 4 commits** com 4 seções detalhadas (refator iniciativa, descricaoResultado, surto array, atalho R)
- Cada seção com motivo, arquivos, mudanças, bugs encontrados e corrigidos
- Tabela resumo dos arquivos tocados na sessão
- Separador `---` entre as sessões 21/07 e 20/07

### Ficha de personagem

**Arquivo**: `arthur-ghost-santiago.json`
- Personagem Ex-policial (Agente de Polícia) no formato exportável do app
- Atributos, perícias, armas, itens, origem, dinheiro

---

## Resumo de arquivos tocados

### Sessão 21/07 (código)

| Arquivo | Mudanças | Linhas |
|---|---|---|
| `src/hooks/useIniciativa.ts` | Hook centralizado de iniciativa | +181 |
| `src/features/iniciativa/IniciativaPanel.tsx` | Componente compartilhado + null safety | +328 |
| `src/features/mapa/CombatOverlay.tsx` | Duplicação substituída por IniciativaPanel | -434 |
| `src/features/npcs/NpcsTab.tsx` | Duplicação substituída por IniciativaPanel | -439 |
| `src/state/store.ts` | surto → array, ?? [], migrations v10→12 | — |
| `src/state/types.ts` | SurtoAtivo[] adicionado | — |
| `src/state/factories.ts` | SCHEMA_VERSION 10→12 | — |
| `src/state/store.test.ts` | Testes de store, migrate, arrays | +270 |
| `src/features/controle/ControlPanel.tsx` | NPCs como alvo de rolagem forçada | — |
| `src/dice/forcarRolagem.ts` | assinar/filaAtual + merge BroadcastChannel | — |
| `src/dice/forcarRolagem.test.ts` | Testes do módulo | +62 |
| `src/features/sessao/sections/CenaAtualSection.tsx` | DT mín 1 | — |
| `src/rules/teste.ts` | descricaoResultado centralizada | — |
| `src/rules/teste.test.ts` | Testes de descricaoResultado | +4 |
| `src/rules/surto.ts` | personagemEstaEmSurto → array | — |
| `src/rules/surto.test.ts` | Testes atualizados para array | — |
| `src/features/mapa/TokenOverlay.tsx` | Armas como badges, label nível {n} | — |
| `src/features/dados/QuickRollOverlay.tsx` | rolarAtualRef contra stale closure | — |
| `src/app/App.tsx` | Atalho R abre e rola sem trocar aba | — |

### Sessão 20/07 (código)

| Arquivo | Mudanças | Linhas |
|---|---|---|
| `src/features/npcs/NpcsTab.tsx` | Null safety (3 funções) + grid 2 colunas + estilo inline ruído (3 chips) | 20 |
| `src/state/store.ts` | `importarJSON` normaliza `acoes` | 5 |
| `src/features/dados/QuickRollOverlay.tsx` | Pills de ação NPC + breakdown resultado simples | 30 |
| `src/features/mapa/TokenOverlay.tsx` | Layout defesa+ações na mesma linha + chip `--ativa` → inline ruído | 60 |
| `src/features/mapa/CombatOverlay.tsx` | Chip de ação: classe `--ativa` → inline ruído | 4 |
| `src/features/dados/RolagemLivre.tsx` | Display do bônus no resultado | 2 |

### Documentação (22/07)

| Arquivo | Mudanças |
|---|---|
| `README.md` | Seções Abas, Atalhos, Janela de Controle, Ruído; `npx serve dist` → `npm run preview`; link ficha.md |
| `ROADMAP.md` | Entrada "Refatoração iniciativa 21/07"; `npx serve dist` → `npm run preview` |
| `CLAUDE.md` | Expandido com state/features/hooks/rules/ruído/combate/ControlPanel; `npm run preview`+`test:watch`; descricaoResultado; surtosAtivos[]; RolagemLivre modo 'nenhum' |
| `DeepSeek.md` | Documentados os 4 commits de 21/07 com bugs/tabelas/resumo |
| `arthur-ghost-santiago.json` | Personagem Ex-policial no formato Ficha do app |
