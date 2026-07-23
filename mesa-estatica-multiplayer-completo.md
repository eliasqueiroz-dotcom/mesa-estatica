# Mesa de Estática — Multiplayer, Permissões e Melhorias

> **Estado e restrições (ler antes de implementar qualquer parte):**
> - O multiplayer (Partes I e II dependentes de Supabase) é trabalho **pós-sessão de 25/07** — o cronograma da Parte I (~7–9 dias) não cabe antes, e não se troca a arquitetura na semana da sessão.
> - A **Parte III é implementável já, local-first** (Zustand, sem Supabase) — ver a seção "Implementação local primeiro" no início da Parte III. É o próximo passo.
> - Adotar Supabase **revoga o requisito "nada depende de internet em runtime" do CLAUDE.md**. A partir da Fase A, esse requisito passa a valer só pro modo fallback GM-solo (risco "offline total", §13). Atualizar o CLAUDE.md quando a Fase A começar — não deixar os dois documentos se contradizendo.

---

# Parte I — Arquitetura multiplayer

## 1. Contexto

O projeto rodava numa máquina só: o GM controla tudo, e a janela de rolagem forçada (`#controle`) fala com o resto do app via `BroadcastChannel` — o que só funciona porque GM e "jogadores" eram, na prática, a mesma pessoa na mesma máquina. Isso deixa de valer no momento em que jogadores reais, em dispositivos diferentes, vão editar a própria ficha, mover tokens no mapa e rolar os próprios dados.

`BroadcastChannel` não atravessa rede — precisa de um backend real. E o requisito de segurança que dita a arquitetura inteira é: **jogador comum nunca pode saber que rolagem forçada existe.**

## 2. Decisão de stack: Supabase

Um único stack cobre tudo que falta:

- **Postgres** — tabelas de estado compartilhado.
- **Realtime** — assinatura de mudanças (token, ficha, log, sessão) empurrada pro navegador sem polling.
- **Row Level Security (RLS)** — a fronteira de segurança de verdade. Não é o front-end que decide o que o jogador vê; é o banco que recusa a query antes dela sair do servidor.
- **Edge Functions** — o único lugar que enxerga a fila de rolagem forçada.

Alternativa equivalente: Firebase (Firestore + Cloud Functions + Security Rules), mesma lógica. Escolha uma e não misture.

## 3. Correção técnica importante: RLS é por linha, não por coluna

Postgres RLS decide se uma **linha inteira** é visível/editável — não esconde colunas individuais dentro de uma linha visível. Isso importa porque o dashboard da aba Sessão mistura, na mesma tela, campo público ("o que os jogadores veem") e campo de mestre ("o que realmente está acontecendo") lado a lado. Se isso for uma linha só numa tabela só, não tem RLS que esconda metade dela.

**Solução: duas tabelas.** `sessao_publica` (todo participante lê) e `sessao_privada` (só o GM lê e escreve). A UI do mestre continua mostrando os dois lado a lado no mesmo dashboard — a separação é só no banco.

## 4. Modelo de dados completo

| Tabela | Leitura | Escrita | Conteúdo |
|---|---|---|---|
| `characters` | todos os participantes | jogador: só a própria linha (`owner_token`) — cria exatamente 1 personagem no primeiro acesso, sem criar adicionais · GM: todas, sem limite | ficha completa de PC |
| `npcs` | todos | **insert/update/delete**: só GM — jogador nunca cria NPC | PV, Defesa, Agilidade, notas, `controlado_por` (nullable — delegação **de movimento**, nunca de criação ou edição de stats) |
| `tokens` | todos (o tabuleiro é visível a todos) | posição: dono do `character_id` (PC) ou GM (qualquer token) ou jogador com `controlado_por` = ele (NPC delegado) · **insert/delete**: só do próprio `character_id` (jogador pode colocar/tirar o próprio token do mapa); NPC insert/delete: só GM | id, character_id, x, y, tipo (`pc`/`npc`) |
| `rolls_log` | todos | escrita: só via Edge Function · **delete ("limpar log")**: só GM | resultado final, origem, alvo (opcional), tipo (teste/sanidade/surto/trauma) |
| `forced_queue` | **ninguém no cliente** — RLS `USING (false)` pra `anon`; só a Edge Function com `service_role` | idem | character_id, valor_forçado, consumido, criado_por |
| `sessao_publica` | todos | só GM | nome da mesa, nº sessão, clima, hora, caso atual, local atual, objetivo, progresso, "o que os jogadores veem", mini log, painel "destaque superior", **e também** o estado de turno/combate: `modo_combate`, `ordem`, `indice_atual`, `rodada`, e o contador `contadorCena` (usado pelo Surto — ver Parte II; não confundir com o campo de texto `cenaAtual` já existente) |
| `sessao_privada` | só GM | só GM | "o que realmente está acontecendo", próximo evento, lembretes do mestre, gauges de Tensão/Ruído narrativo/Ameaça, estatísticas da sessão (rolagens/surtos/mortes/tempo) |
| `media` | pasta `geral`: todos · pasta `gm`: só GM | `geral`: todos inserem · `gm`: só GM insere · mover de `gm`→`geral`: só GM · delete: GM sempre, jogador só o que ele mesmo subiu em `geral` *(assunção — confirmar antes de implementar)* | arquivo (via Supabase Storage, tabela guarda só a URL/metadados), pasta, autor, rótulo |

O ponto que importa em todas as tabelas sensíveis: mesmo que um jogador abra o DevTools e inspecione o tráfego de rede, `forced_queue` e `sessao_privada` **nunca aparecem** — porque o cliente dele nunca teve permissão de consultar essas tabelas, em nenhum momento.

## 5. Como a rolagem forçada nunca vaza — o mecanismo

Tanto o cliente do GM quanto o do jogador chamam a **mesma** Edge Function pra resolver uma rolagem (`resolver-rolagem`):

1. Cliente manda `{ session_id, character_id, formula }` (ex: `1d20+atributo+perícia`).
2. A função, no servidor: consulta `forced_queue` por uma entrada não consumida pra aquele `character_id`. Se existir, usa o valor forçado e marca como consumido. Se não, gera o valor honesto.
3. Grava o resultado final em `rolls_log` (público) e retorna só isso pro cliente que pediu.
4. O cliente recebe apenas `{ resultado: X }` — nunca um campo `forcado: true/false`.
5. A UI usa o mesmo truque que a `dice-box-threejs` já faz localmente (swap de face pós-física) pra fazer o dado 3D "cair" no valor retornado — visualmente indistinguível de honesto.

**Física real vs. servidor:** a física do dado roda no navegador de quem rolou (Three.js local) — o servidor só decide o *número*, o cliente decide a *animação*.

## 6. Papéis: GM vs. Jogador

- **Jogador**: entra por um link com `session_id` + um **`owner_token` secreto e não-adivinhável** (UUID aleatório, ex: `?s=abc&t=7f3e…`) — é o mesmo `owner_token` da tabela `characters` (§4). O link **não** carrega `character_id` puro: id de personagem aparece no tráfego de rede visível a todos (log, tokens), então um link baseado só nele seria forjável por qualquer jogador. O token resolve pra **a** ficha (uma só — jogador comum não cria personagem adicional) da qual o portador é dono. Sem privilégio elevado.
- **GM**: entra por um link com um **token de GM**, comparado dentro da Edge Function — nunca embutido no bundle JS que vai pro navegador. Só esse token dá acesso a `queue-forced-roll`, à janela `#controle`, à edição de `npcs`/`sessao_privada`/mapas, e ao "limpar log".

**Limitação técnica que define a implementação:** a chave `anon` do Supabase é **compartilhada por todos os clientes** — todo mundo chega ao banco com o mesmo JWT, então uma policy RLS `USING (owner_token = ...)` não tem, sozinha, como saber *quem* está chamando. Duas soluções, escolher uma:

1. **Supabase Anonymous Auth (recomendada)**: no primeiro acesso, o cliente faz sign-in anônimo e ganha um `auth.uid()` estável por dispositivo; uma Edge Function `vincular-jogador` valida o `owner_token` do link uma única vez e grava o `auth.uid()` na(s) linha(s) de `characters`. Daí em diante as policies usam `auth.uid()` normalmente — RLS de verdade, sem token trafegando em cada request.
2. **Escrita 100% via Edge Function**: o cliente nunca escreve direto nas tabelas; toda mutação passa por função que valida o `owner_token`. Mais simples de raciocinar, porém mais latência por operação e as policies de escrita do §4 viram lógica de função.

O §4 está escrito assumindo a solução 1 (policies citando "dono"). Se optar pela 2, reler a coluna "Escrita" da tabela traduzindo cada regra pra validação de função.

### 6.1 Interagir com NPC sem poder editá-lo

Jogador não move nem edita um NPC (a não ser que autorizado — ver 6.2), mas precisa poder agir sobre um (atacar, persuadir, examinar). Isso passa inteiro pela `resolver-rolagem`: o cliente manda `{ character_id: <o dele>, alvo_id: <o NPC>, formula }`; a função resolve o valor e, se for ataque, aplica o dano no NPC usando `service_role` — o jogador nunca escreveu em `npcs` diretamente.

### 6.2 Permissões dinâmicas em tempo real

**Ceder/revogar controle de NPC (liga/desliga, trava com RLS):** `npcs`/`tokens` de NPC têm `controlado_por` (nullable). Policy de escrita do jogador em token de NPC checa `controlado_por = <character_id dele>`. GM cede com um `UPDATE controlado_por = 'aria'`, revoga com `null`. RLS é avaliada a cada request — efeito instantâneo, sem refresh.

**Condições tipo "lento" (contínuo, não é liga/desliga — não vira RLS boolean):** `characters` ganha `condicoes: string[]`, editável só pelo GM. A validação de movimento de token não vira RLS binária — vira checagem na função que aceita a atualização de posição, comparando distância pedida com o limite da condição ativa.

Princípio: **identidade (quem pode escrever) é RLS; regra de jogo (quanto pode fazer) é lógica de função.**

### 6.3 Turnos, ordem de jogada e contagem de rodada

Campos em `sessao_publica` (ver seção 4): `modo_combate`, `ordem` (array `{tipo:'pc'|'npc', id, iniciativa}`), `indice_atual`, `rodada`.

- GM sempre age livremente, em qualquer fase — o caminho dele nunca checa `indice_atual`.
- `modo_combate = true`: ações que "consomem a vez" (mover token de forma significativa, chamar `resolver-rolagem` com ação de combate) checam se `ordem[indice_atual].id` bate com quem pediu; se não, a função recusa.
- Ações que não consomem a vez (editar notas, ver a ficha, ajustar dinheiro) continuam sempre livres, mesmo em combate.
- `avancar-turno` (só GM): incrementa `indice_atual`, soma 1 em `rodada` ao dar a volta.
- Ligar `modo_combate` roda o rolador de iniciativa já existente pra PCs ativos + NPCs marcados, popula `ordem`. Desligar só para de checar a trava — não zera `ordem`/`rodada`.

## 7. Mapas — detalhamento

- **Só GM**: carregar/trocar imagem de fundo, ligar/desligar grid, ajustar grid, editar stats de NPC.
- **Só GM por padrão, delegável**: mover token de NPC (via `controlado_por`, seção 6.2).
- **Jogador**: move o próprio token; adiciona/remove o próprio token do mapa (RLS: insert/delete em `tokens` só quando `character_id` = o próprio). Não se estende a token de outro jogador nem de NPC.
- Mover ≠ editar: um jogador autorizado a mover um NPC ainda não edita PV/Defesa dele — isso continua GM-only.

## 8. NPCs — só o mestre cria; delegação é só de movimento, pontual

- **Insert/Update/Delete**: só GM, sem exceção — jogador comum não cria NPC em nenhuma circunstância (correção em relação a uma versão anterior deste doc, que abria o insert a todos).
- `controlado_por` (nullable, §6.2/§7) é o único jeito de um jogador agir sobre um NPC além de `resolver-rolagem` (§6.1): o GM cede o campo pontualmente pra delegar **mover o token** daquele NPC — nunca editar PV/Defesa/Agilidade/notas, que continuam GM-only mesmo com o token delegado.
- Delegação não é permanente: GM revoga a qualquer momento com `UPDATE controlado_por = null`; RLS reavalia a cada request, efeito instantâneo (§6.2).

## 9. Mídia — duas pastas

- `media.pasta`: `'gm' | 'geral'`.
- Leitura: `geral` visível a todos; `gm` só ao GM.
- Upload: jogador só em `geral`; GM em qualquer uma.
- "Revelar": GM muda `pasta` de `gm` pra `geral` — vira público instantaneamente via Realtime.
- Exclusão: GM sempre; jogador só o que ele mesmo subiu em `geral` *(assunção a confirmar)*.
- Vídeo/áudio não cabem em campo de texto/JSON — usar Supabase Storage e guardar só a URL na tabela `media`.

## 10. Matriz de permissões por aba (resumo de consulta rápida)

| Aba | Leitura | Escrita |
|---|---|---|
| Sessão — público | todos | só GM |
| Sessão — privado | só GM | só GM |
| Personagens | todos | jogador: só a própria, 1 única, sem criar adicionais · GM: todas |
| Dados & Regras | todos | todos (via `resolver-rolagem`) |
| Rolagem Forçada (`#controle`) | só GM | só GM |
| Mapas | todos veem o tabuleiro | GM: tudo · jogador: próprio token + NPC delegado |
| NPCs | todos | criar/editar: só GM · mover: só GM (ou jogador delegado pontualmente via `controlado_por`) |
| Logs | todos | escrita: via função · limpar: só GM |
| Mídia | `geral`: todos · `gm`: só GM | `geral`: todos sobem · `gm`: só GM |

## 11. Migração incremental

- **Fase A — só tokens.** Sincronizar posição x/y via Realtime. Menor risco, maior valor imediato.
- **Fase B — fichas.** Cada jogador edita a própria linha em `characters`; GM assina todas.
- **Fase C — rolagens.** `resolver-rolagem` honesta primeiro, valida com dois dispositivos reais, depois liga `forced_queue` + `#controle` na função.
- **Fase D — corte da janela `#controle`** pro novo transporte, com `BroadcastChannel` como fallback só pro GM sozinho sem internet.
- **Fase E — Sessão pública/privada.** Criar as duas tabelas, migrar os campos do dashboard (Parte III), GM lendo ambas.
- **Fase F — Permissões finas de Mapas/NPCs/Personagens.** RLS de 1 personagem por dono (`owner_token` vincula exatamente 1 linha em `characters`, sem insert adicional pelo jogador), insert/update/delete de `npcs` restrito ao GM, insert/delete de `tokens` restrito ao próprio `character_id`, `controlado_por` exposto na UI como "quem pode mover".
- **Fase G — Mídia.** Tabela `media` + Storage, upload em `geral` liberado, `gm` restrito, ação "mover pra Geral".
- **Fase H — Limpar logs.** Botão condicional (só GM) + policy de delete em `rolls_log`.

Ordem sugerida: E antes de F (dashboard do GM fica utilizável cedo) — F e G podem ser paralelas — H encaixa em qualquer folga.

Zustand não sai do projeto — vira cache local/otimista; Supabase é a fonte de verdade compartilhada por cima.

## 12. O que muda no código existente

- `useDiceBox.ts`: chama `resolver-rolagem` em vez de resolver localmente; usa o valor retornado pro swap de face.
- `ControlPanel.tsx`/rota `#controle`: troca `BroadcastChannel.postMessage` por `fetch` autenticado com token de GM.
- Boot do app: lê `session_id`, `character_id` (jogador) ou `gm_token` (GM) da URL.
- Mapa: upload de imagem grande demais pro broadcast → Supabase Storage, sincroniza só a URL.

## 13. Riscos

| Risco | Mitigação |
|---|---|
| Jogador inspeciona rede e tenta ler `forced_queue`/`sessao_privada` direto | RLS `USING (false)` pra `anon` — a tabela não existe do ponto de vista do cliente |
| GM token vazar | Token valida só server-side; trocar invalida acesso antigo sem redeploy |
| Link de jogador vazar ou ser forjado | `owner_token` é UUID aleatório (não-adivinhável); vazou → GM regenera o token daquele jogador e reenvia o link, sem afetar os demais |
| Latência atrapalhar o momento da rolagem ao vivo | Testar com dispositivos reais antes do dia da sessão |
| Offline total no dia | Fallback: GM sozinho no modo local (`BroadcastChannel`), players assistem por screen share |

## 14. Cronograma aproximado

Fase A: ~1 dia · B: ~1–2 dias · C: ~1–2 dias (rolagem forçada exige teste com dois dispositivos reais) · D + teste de latência real: ~1 dia · E: ~0,5–1 dia · F: ~1 dia · G: ~0,5–1 dia · H: trivial.

## 15. Checklist de robustez

- [ ] Teste automatizado: ler `forced_queue` e `sessao_privada` com chave `anon` deve falhar/retornar vazio.
- [ ] Presença em tempo real (Supabase Realtime Presence) — indicador só-GM de quem está conectado.
- [ ] Reconexão: jogador perde wifi ou atualiza a página e volta exatamente onde estava.
- [ ] Toda Edge Function revalida no servidor (personagem existe? pertence a quem chamou? alvo válido?) — nunca confiar em dado vindo do cliente.
- [ ] Botão que gera todos os links da sessão (GM + um por jogador) de uma vez.
- [ ] Ensaio geral com pelo menos 2 pessoas reais, em dispositivos reais, tentando quebrar regra de propósito: mexer em token/NPC alheio, adivinhar se um dado foi forçado, ler a pasta `gm` de Mídia, atualizar a página no meio de uma ação.
- [ ] Jogador tenta criar um NPC e a operação é recusada pelo RLS (não só escondida no front-end).
- [ ] Jogador tenta criar uma segunda ficha própria e a operação é recusada pelo RLS.
- [ ] Botão "limpar log" não aparece nem funciona via chamada direta pro jogador.

## 16. Ordem de prioridade

**Não cortável:** RLS de `forced_queue`/`sessao_privada` bloqueando de verdade, sincronia de ficha/token/dados entre dispositivos reais, log coerente, reconexão não quebrar a sessão.

**Cortável sem prejudicar a sessão:** sistema de turnos (degrada pra "GM fala em voz alta de quem é a vez"), troca de controle de NPC e condições de movimento (GM narra manualmente).

---

# Parte II — Melhorias de UI/UX

## 1. Overlay de token — ver detalhes e ajustar rápido

Clicar num token (PC ou NPC) no mapa abre um overlay (fecha por botão X, clique fora, ou Esc):

- PC: nome, PV atual/máx com stepper +/-, Sanidade atual/máx com stepper +/-, Determinação (checkboxes já existentes).
- NPC: PV atual/máx, Defesa, Agilidade, notas.
- Escreve direto no Zustand/Supabase — não duplicar estado. Mudar aqui reflete na aba Personagens/NPCs e vice-versa.
- Precisa de **distinção clique vs. arrasto** (limiar de poucos pixels) pra não abrir o overlay toda vez que o token é só reposicionado.
- **Permissão (pós-multiplayer):** steppers de edição só ficam ativos se for a própria ficha (jogador) ou GM; outros PCs/NPCs abrem em modo leitura — visualizar é permitido a todos (ficha de PC e NPC são de leitura pública, seção 4), editar segue a matriz.

## 2. Surto: marcação até o fim da cena

> **Cuidado com o nome:** já existe `sessao.cenaAtual: string` no Zustand (`src/state/types.ts`) — é o **texto livre** descrevendo a cena, editado ao vivo na aba Sessão. O campo desta seção é outro: um **contador numérico**. Por isso o nome `contadorCena` — não reaproveitar nem sobrescrever o `cenaAtual` existente.

- Contador de cena `contadorCena` em `sessao_publica` (seção 4/Parte I), incrementado por um botão "Avançar cena" na aba Sessão.
- Quando o motor de regras dispara Surto, gravar `surto_ativo: { cena_id: contadorCena }` na ficha (não um booleano solto).
- Exibir marcador (ficha e token) enquanto `personagem.surto_ativo?.cena_id === sessao.contadorCena`.
- Vantagem de contador em vez de flag manual: um clique em "Avançar cena" invalida o Surto de todos de uma vez, sem iterar personagem por personagem.
- Token 3D: reaproveitar a lógica de tiers de ruído já existente (brilho/pulso derivado de um cálculo, não de estado imperativo espalhado).

## 3. Cor de token editável

- Campo de cor na ficha (Personagens) e NPCs, refletindo direto no token — mesma fonte de estado.
- **Não usar color picker RGB livre.** Usar swatches curados dentro da paleta já definida (ciano corporativo / âmbar analógico / vermelho sujo) — um picker aberto eventualmente gera um token fora da direção de arte na frente dos jogadores.
- Mapeia direto pra uma coluna `cor` em `characters`/`npcs`.

## 4. Modo combate por turnos

Já é parte do modelo de dados real da Parte I (seção 6.3, campos em `sessao_publica`) — não é mais "local, pré-multiplayer", é a versão de produção. Resumo funcional:

- Ligar/desligar `modo_combate`, popular `ordem` via iniciativa já existente, avançar turno incrementando `indice_atual`/`rodada`.
- Leitura pra todos (todo mundo vê de quem é a vez), escrita só GM.

## 5. Fix: grid do mapa muda o tamanho do mapa

Bug de layout — diagnóstico preciso: o **overlay** do grid (`.mapa-grade`) já é `position: absolute` dentro de `.mapa-area` e não é o problema. Quem encolhe o mapa é a **linha de campos de configuração** (`.mapa-grade-config`, os inputs de colunas/linhas/x/y/largura/altura em `MapaTab.tsx`): ela é irmã de `.mapa-area` no fluxo normal da coluna flex, então aparecer/sumir com o toggle rouba altura do mapa (`flex: 1`).

- Container do mapa com proporção fixa (`aspect-ratio`), independente de qualquer controle ao lado.
- Overlays (grid, moldura de arrasto) continuam `position: absolute; inset: 0` **dentro** do container — isso já está certo.
- Os campos de configuração do grid saem do fluxo vertical: ou entram na toolbar existente (que pode quebrar linha sem afetar o container de proporção fixa), ou viram um painel flutuante sobre o mapa.

## 6. Aba Mídia

Galeria de imagens, vídeos, fotos de prova e sons — ver modelo de dados completo na Parte I, seção 9 (duas pastas, GM e Geral).

- Grid de itens com thumbnail/preview, rótulo editável, botão de excluir.
- Abrir um item reaproveita o mesmo padrão de overlay com botão de fechar do item 1.
- Imagem comprimida no upload (mesmo esquema já usado no mapa); vídeo/áudio vão pro Supabase Storage, nunca embutidos em JSON/localStorage.

---

# Parte III — Dashboard da aba Sessão

> Campos marcados **[Público]** vivem em `sessao_publica` (todos leem); **[Privado]** vivem em `sessao_privada` (só GM). Ver Parte I, seções 3–4, pro porquê da separação em duas tabelas.

## 0. Implementação local primeiro (pré-Supabase) — é por aqui que se começa

Esta parte **não espera o multiplayer**: implementa-se já, no Zustand, com os objetos público/privado separados desde o início — quando a Fase E (Parte I §11) chegar, cada objeto vira uma tabela sem redesenho.

**Forma no estado** (`src/state/types.ts` / `store.ts`):

- `EstadoGlobal` ganha dois objetos irmãos, `sessaoPublica` e `sessaoPrivada`, substituindo o atual `sessao` (que é absorvido pelo `sessaoPublica`).
- `sessaoPublica`: os 4 campos atuais que migram (`nomeDaMesa`, `numeroSessao`, `clima`, `hora`) + `cenaAtual` (o texto livre existente — mantém nome e semântica) + os novos: `caso`, `localAtual`, `objetivo`, `progresso` (ex: `{ atual: 3, total: 8 }`), `atmosfera`, `oQueOsJogadoresVeem`, `contadorCena` (número, ver Parte II §2).
- `sessaoPrivada`: `oQueRealmenteAcontece`, `proximoEvento`, `lembretes` (lista), `eventos` (checklist `{ texto, feito }[]`), gauges `tensao`/`ruidoNarrativo`/`ameaca` (0–100), `estatisticas` (rolagens/surtos/mortes — contadores incrementados pelas ações do store que já registram esses eventos no log).
- **Migração de schema** no `migrate` do `persist` (padrão v1→v2 já existe em `store.ts`): bump pra v3, movendo os campos de `sessao` pros novos objetos e preenchendo o resto com defaults de uma factory (`criarSessaoPublica`/`criarSessaoPrivada` em `factories.ts`).
- Actions no padrão existente: `atualizarSessaoPublica(patch)` / `atualizarSessaoPrivada(patch)` (shallow-merge, como `atualizarGrade`).

**Derivados, não armazenados** (não criar estado novo pra isso):

- Mini log (§7): últimos N do `log` já existente.
- Destaque superior (§8): lê `localAtual`/`objetivo`/`hora` de `sessaoPublica`.
- "Personagens/NPCs" das estatísticas (§6): `fichas.length`/`npcs.length`.

**Aviso honesto:** localmente a separação é **organizacional** — tudo vive no mesmo localStorage e no mesmo export JSON; um jogador olhando a tela do GM vê tudo. A fronteira de segurança real só nasce quando os dois objetos virarem as duas tabelas com RLS (Fase E). O valor de separar agora é o dashboard já nascer com o desenho certo e a migração futura ser mecânica.

## 1. Situação da sessão — [Público]

- Nome da mesa · Número da sessão · Clima · Hora · Caso atual · Local atual · Objetivo dos jogadores · Progresso da investigação (ex: 3/8 pistas)

```
Mesa: Estática
Sessão: 1
Caso: O Silêncio da Luz
Local: Estação da Luz
Objetivo: Encontrar o informante
Progresso: 3/8 pistas
```

## 2. Cena atual (expandida) — misto

```
CENA ATUAL

Local                                    [Público]
Estação da Luz - Plataforma 2

Atmosfera                                [Público]
garoa • energia instável • pouca iluminação

O que os jogadores veem                  [Público]
...

O que realmente está acontecendo         [Privado]
(apenas mestre)

Próximo evento                           [Privado]
Quando alguém abrir a porta...
```

## 3. Estado da mesa — [Privado]

Indicadores de ritmo, só pro mestre — mostrar isso a jogadores seria metagame.

```
Tempo: 23:47
Tensão   ██████░░░░ 60%
Ruído    ███░░░░░░░ 30%
Ameaça   ████░░░░░░ 40%
```

## 4. Próximos eventos — [Privado]

Checklist de acontecimentos, é spoiler por definição.

```
☐ Chegada do trem
☐ NPC aparece
☐ Blackout
☐ Criatura invade
☑ Primeira pista encontrada
```

## 5. Lembretes do mestre — [Privado]

```
• João esqueceu de gastar Determinação.
• Ana está Ferida.
• Rafael mente sobre a empresa.
• Mostrar imagem 03 quando abrirem a porta.
```

## 6. Estatísticas da sessão — [Privado]

```
Personagens: 2       NPCs: 8
Rolagens: 37          Surtos: 1        Mortes: 0
Tempo de sessão: 01h34
```

## 7. Mini log — [Público]

Deriva de `rolls_log` (que já é público, Parte I seção 4) — não precisa de campo próprio, é uma view dos últimos N registros.

```
23:12  Maria perdeu 6 de Sanidade.
23:16  Pedro encontrou a chave.
23:20  NPC Eduardo morreu.
```

## 8. Destaque superior — [Público]

Painel sempre visível, deriva dos campos públicos acima (não é estado novo).

```
━━━━━━━━━━━━━━━━━━━━━━
LOCAL: ESTAÇÃO DA LUZ
OBJETIVO: Encontrar o informante
TEMPO: 23:47
━━━━━━━━━━━━━━━━━━━━━━
```

## Benefícios

- Menor carga cognitiva para o mestre.
- Informações críticas sempre visíveis.
- Menos troca entre abas.
- Sensação de software profissional durante a sessão.
- **Adicional pós-multiplayer:** a separação público/privado que já fazia sentido pra organização visual do mestre agora também é a fronteira de segurança real — o mesmo desenho serve aos dois propósitos.
