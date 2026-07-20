# Correções — Partes II e III (pós-implementação)

> Referencia `mesa-estatica-multiplayer-completo.md`. Parte I (multiplayer) e item 6 da Parte II (aba Mídia) ainda pendentes — o resto abaixo é ajuste sobre o que já foi implementado.

**Status em 19/07: os 12 itens abaixo estão resolvidos.** Item 2 não precisou de código (investigado — o comportamento atual já está correto, ver nota). Aba Mídia (Parte II item 6 do doc original) e Parte I (multiplayer/Supabase) continuam fora de escopo, como já estava marcado.

## 1. Aviso de personagem vazando entre fichas ("marque um trauma" aparece em todos)

**Sintoma:** personagem 1 com Sanidade baixa mostra o aviso corretamente; ao trocar pra personagem 2 com Sanidade cheia, o mesmo aviso continua aparecendo.

**Causa provável:** o aviso está sendo computado a partir de um estado "personagem atual" compartilhado/singleton (ex: um seletor tipo `usePersonagemSelecionado()` que guarda o resultado calculado uma vez), em vez de ser recalculado **por ficha, a partir dos próprios campos daquela ficha**, toda vez que ela renderiza.

**Fix:** o aviso precisa ser uma função pura de `(personagem.sanidadeAtual, personagem.sanidadeMaxima)` chamada individualmente dentro do componente de cada ficha — nunca lida de um valor computado globalmente e reaproveitado entre personagens. Se existir um hook tipo `useAvisoTrauma()` sem receber o `personagem` como parâmetro, esse é o bug.

**Resolvido em 19/07:** `FichasTab.tsx:52` — adicionado `key={fichaAtiva.id}` ao `<FichaEditor>`. React desmontava o editor antigo ao trocar de personagem? Não, sem `key` ele reutilizava a mesma instância, e o `useState` de `alertas` em `AtributosDerivadosSection.tsx:29` vazava entre fichas. Com `key`, cada troca de personagem monta um `FichaEditor` novo, estado local zerado.

## 2. Botão "sortear na tabela (d20)" do Trauma ignora a rolagem forçada

**Causa provável:** esse botão está chamando `Math.random()` (ou um utilitário de dado separado) diretamente, em vez de passar pelo mesmo caminho central de resolução de rolagem que os testes normais usam.

**Fix:** **toda** rolagem de d20 no app — teste padrão, Surto, Trauma, qualquer tabela — precisa passar pela mesma função central (`useDiceBox`/resolução de rolagem, a que já checa a fila forçada). Não pode haver um segundo caminho de rolagem no código. Se o Trauma tem um botão próprio, ele deve chamar a mesma função central com o formulário `1d20`, não reimplementar a sorte.

**Investigado — não é bug, é intencional:** grep por `Math.random()` no app inteiro mostra só 4 usos fora de `useDiceBox.ts` (o caminho central, que já checa a fila forçada):
- `TraumasSection.tsx:35` ("sortear na tabela") — não é uma rolagem no sentido do app, é a escolha de qual trauma novo entra na ficha (equivalente a rolar um personagem, não a testar algo na mesa). Já foi tentado ligar isso à fila de rolagem forçada e isso causou um bug real: um valor forçado destinado a um teste normal era consumido silenciosamente se alguém sorteasse um trauma antes. Ficou deliberadamente isolado, com o comentário explicando o porquê no próprio código.
- `store.ts:231` (`rolarIniciativaTodos`) e `rules/surto.ts:30` (duração do Surto em combate, 1d4+1) — rolagens de bastidor que nunca apareceram fisicamente na bandeja (iniciativa é resolvida em lote pro grupo inteiro; a duração do Surto é um detalhe mecânico, não algo que o jogador vê rolar).
- `tokens3d/TokenScene.tsx` — não é rolagem, é o jitter visual do cristal 3D.

Nenhum desses é "uma rolagem de d20 que devia estar na bandeja e não está" — são categorias diferentes de aleatoriedade que nunca tiveram motivo pra passar pela fila forçada.

## 3. Marcador de Surto não aparece no token, e precisa aparecer também na ficha

**Sintoma:** token no mapa não mostra o indicador de Surto ativo; a ficha do personagem também deveria mostrar, e não está confirmado que mostra.

**Causa provável:** Token e Ficha provavelmente têm duas implementações separadas checando a condição de Surto ativo, e uma delas (ou as duas) está desatualizada ou com o nome de campo errado depois de algum refactor.

**Fix:** criar uma única função auxiliar, ex. `personagemEstaEmSurto(personagem, sessao)`, e usar ela nos dois lugares (Token 3D e Ficha) — nunca duas implementações da mesma checagem.

**Correção de regra a decidir antes de corrigir o bug:** o livro define dois casos de duração de Surto — *"até o fim da cena — ou 1d4+1 rodadas em cena de ação."* Ou seja, fora de combate a duração é por cena (`cena_atual`, como já desenhamos), mas **em combate é por rodada, com uma rolagem de 1d4+1**, não a mesma lógica de contador de cena. Se `modo_combate` estiver ativo no momento do Surto, o correto é rolar `1d4+1` e gravar algo como `surto_ativo: { expira_na_rodada: rodada_atual + resultado }`, e comparar com `sessao.rodada` em vez de `cena_atual`. Fora de combate, mantém o comportamento por cena já especificado.

**Resolvido em 19/07:**
- `src/rules/surto.ts` — criadas duas funções compartilhadas:
  - `calcularExpiraSurto(sessao)`: fora de combate retorna `contadorCena`; em combate retorna `rodada + Math.floor(Math.random() * 4) + 1` (1d4+1).
  - `personagemEstaEmSurto(surtoAtivo, sessao)`: fora de combate checa `=== contadorCena`; em combate checa `>= rodada`.
- `store.ts:171` — `ajustarSanidadeAtual` usa `calcularExpiraSurto` em vez de gravar `contadorCena` fixo.
- `AtributosDerivadosSection.tsx:42` — badge "surto ativo" usa `personagemEstaEmSurto`.
- `MapaTab.tsx:210` — pulso no token 3D e `data-surto` no DOM usam `personagemEstaEmSurto`.
- `TokenScene.tsx:123` — cristal 3D escala com `Math.sin()` quando `surtoAtivo`.
- 7 testes em `surto.test.ts` cobrindo fora/combate/null/destino-insiste.

## 4. GM não deve sofrer o efeito visual de ruído de Sanidade dos personagens

**Problema de design, não só bug:** hoje o efeito de estática/glitch (ligado à Sanidade de um personagem) está degradando a própria tela do GM — que é quem precisa continuar lendo a interface com clareza pra tocar a sessão. O efeito imersivo faz sentido pra quem está "sendo" aquele personagem (o jogador, quando ele tiver tela própria no multiplayer), não pra quem está administrando o jogo.

**Fix:** separar o "efeito imersivo completo" (degradação visual real) — que deve viver na futura visão do jogador — da visão do GM, que deve mostrar só um **indicador compacto** (badge/medidor de "nível de ruído: alto"), nunca a tela inteira do painel de mestre ficando difícil de usar.

**Resolvido em 19/07** (decisão: suavizar tier 3 + indicador compacto, não remover o efeito nem deixar como está):
- `styles/ruido.css` — removida a chroma aberration nos headers e o glitch de skew no `body` (tier 2/3); esses distorciam texto de verdade. Grain, scanlines e vinheta continuam — são atmosféricos, não atrapalham leitura de número.
- `RuidoOverlay.tsx` — exporta `NOME_TIER_RUIDO` e o hook `useTierRuidoFichaAtiva()`, reaproveitados pelo indicador e pelo badge da ficha (antes cada lugar tinha seu próprio mapa de nomes).
- `DestaqueSuperior.tsx` — novo segmento "RUÍDO SANIDADE: {tier}" na faixa sempre visível (qualquer aba), colorido por tier (ink → real → ruído). Só aparece com uma ficha ativa selecionada.
- Efeito completo (chroma/glitch) fica pendente pra quando existir visão separada do jogador (Fase E do multiplayer).

## 5. Melhorar visualização do "ruído narrativo" e da "Ameaça"


**Fix sugerido:**
- Para evitar confusão Renomear um dos dois — sugestão: o efeito visual de sanidade vira **"Ruído Sanidade"** ; o gauge do dashboard mantém **"Ruído Narrativo"**. Nomes diferentes, sem ambiguidade em código nem em conversa.
- Melhorar o visual do ruido narrativo e ameaça para que seja mais chamativo, para que passe a sensação de "o tempo está acabando" mas sem atrapalhar muito a visualização e leitura da tela da tela

**Resolvido em 19/07:**
- `AtributosDerivadosSection.tsx` — label renomeada de "nível de ruído" → "ruído sanidade" (tier 2 também exibe "ruído sanidade" em vez de só "ruído").
- `EstadoMesaSection.tsx` — gauges de Ruído narrativo e Ameaça agora mostram badge de severidade ao lado do valor: `○ normal`, `◔ atenção`, `◕ crítico`, `● colapso`, colorido por tier (ink-faint → real → ruído).
- `ficha.css` — barra do gauge em tier 3 ganhou animação `gauge-colapso-pulso` (opacity oscila, sensação de instabilidade).
- `alerta-sessao.css` — Ruído narrativo reformulado: vinheta ciano + estática craquelê (feTurbulence, overlay blend) no tier 2+; tier 3 ganhou glitch no body e chroma aberration nos headers (só ciano, diferente da Sanidade que mescla vermelho). Ameaça também teve intensidade aumentada pra equiparar (color-mix com mais opacidade, pulso igual ao ruído).

## 6. Renomear botão "Imprimir tudo" → "Exportar"

Troca direta de label, sem mudança de comportamento.

**Resolvido em 19/07:** `App.tsx:60` — "imprimir tudo" → "exportar".

## 7. Caixas da aba Sessão devem ter a mesma largura da aba Personagens

Ajuste de CSS: aplicar a mesma largura/container usado nos cards da aba Personagens aos blocos da aba Sessão — hoje estão com dimensionamento diferente entre as duas abas.

**Resolvido em 19/07:** `SessaoTab.tsx:14` — removido `maxWidth: 1100` do container principal. As seções da aba Sessão agora ocupam a largura total disponível (assim como as da aba Personagens, que nunca tiveram maxWidth).

## 8. Caixas de texto da aba Sessão precisam ser maiores

Os campos de texto livre (ex: "o que está acontecendo", lembretes do mestre) carregam bastante conteúdo — aumentar a altura padrão dos `textarea` dessa aba (ou torná-los redimensionáveis/auto-expansíveis conforme o conteúdo cresce, o que evita ter que readequar o tamanho fixo de novo no futuro).

**Resolvido em 19/07:** `CenaAtualSection.tsx` — "O que os jogadores veem" subiu de `minHeight: 5em` → `10em`; "O que realmente está acontecendo" subiu de `5em` → `8em`. Ambos com `resize: vertical` (já vinha do `base.css`).

## 9. Mais opções de cores

Preciso de pelo menos 10 opções de cores para os personagens seguindo o padrão de cores do jogo e para os NPCS pode ser RGB livre e também preciso que os Tokens seja a Primeira Letra do nome e a primeira do Sobrenome (por exemplo Nome: "Guarda 1" para que fique G1 no token do mapa)

**Resolvido em 19/07:**
- `factories.ts:16-19` — paleta expandida de 6 para 10 cores: adicionados `#a8463e` (ruído), `#5a7d9a` (azul-ardósia), `#d48c4a` (laranja queimado), `#3a8a7a` (verde-azulado escuro).
- `NpcsTab.tsx:53` — `SeletorCor` removido dos NPCs, substituído por `<input type="color">` nativo (RGB livre).
- `MapaTab.tsx:302` — token agora exibe iniciais (1ª letra do nome + 1ª letra do sobrenome). Função `iniciaisToken()` em `MapaTab.tsx:18-24`: "Guarda 1" → "G1", "Maria Silva" → "MS", "João" → "J".

## 10. Conversor automático de dinheiro (R$ ↔ P$)

**Contexto:** a `DinheiroSection` exibe os valores de `dinheiroReal` (R$) e `dinheiroPonto` (P$) lado a lado com botões +/- de 1, 10, 100. O texto "câmbio: P$ → R$ com cambista custa 30%" é só informativo — não tem conversão automática.

**Regras (regras.md §"grana e equipamento"):**
- Câmbio oficial: 1 P$ = 1 R$ (fachada do sistema Ponto®).
- P$ → R$ com cambista: -30% (ex: 100 P$ viram 70 R$).
- R$ → P$: exige justificar origem (o mestre pode bloquear ou permitir manualmente).

**O que implementar:**
- Botão "converter" entre os dois cards da `DinheiroSection` (ou um modal leve).
- Usuário informa:
  - Valor a converter
  - Direção: R$ → P$ ou P$ → R$
- Se P$ → R$: desconto de 30% automático. Ex: digita 100 P$, resultado mostra 70 R$.
- Se R$ → P$: mostra aviso "justificar origem — o mestre decide se permite". Executa mesmo assim (o mestre desfaz se não aprovar).
- A conversão chama `ajustarDinheiro` do store (que já logs a transação com delta e origem).
- Log da sessão com tag `'dinheiro'` registra: "João: câmbio R$→P$ 100 (R$ 500 → 400, P$ 800 → 900)".
- Ficar esperto com valores negativos ou excedentes (máscara de número não-negativo, no mínimo 0).

**Arquivos relevantes:**
- `src/features/fichas/sections/DinheiroSection.tsx` — onde o conversor deve viver
- `src/state/store.ts:203-218` — `ajustarDinheiro` (já implementada)
- `src/state/types.ts:76-77` — `dinheiroReal` e `dinheiroPonto` na `Ficha`
- `src/state/factories.ts:51-52` — valores padrão R$ 500, P$ 800

**Resolvido em 19/07:**
- `store.ts` — nova action `converterDinheiro(id, direcao, valor)`: debita no máximo o saldo disponível na moeda de origem, credita a outra (P$→R$ com -30%, R$→P$ 1:1), grava as duas pernas numa única entrada de log `'dinheiro'` (formato igual ao exemplo do doc).
- `DinheiroSection.tsx` — bloco "câmbio": select de direção, input de valor, preview ao vivo ("P$ 100 → R$ 70"), aviso de "justificar origem" quando R$→P$, aviso de saldo insuficiente quando o valor digitado excede o disponível.
- Testado ao vivo: P$ 800→700, R$ 500→570, log "Gui: câmbio P$→R$ 100 (P$ 800 → 700, R$ 500 → 570) — taxa do sigilo, 30%".

## 11. Sinalizador de Surto na ficha — mostrar qual efeito está ativo, não só "surto ativo"

**Contexto:** hoje `AtributosDerivadosSection.tsx:143` exibe um badge `surto ativo nesta cena` quando `personagemEstaEmSurto` retorna true. Mas isso não informa **qual entrada da Tabela de Surto** foi rolada/escolhida. O jogador (e o mestre) precisam ver o nome e descrição do efeito ativo.

**Problema:** o Surto dispara em `ajustarSanidadeAtual` (store.ts:170) mas a função `resolverSurto(d20A, d20B)` em `src/rules/surto.ts` nunca é chamada — ela só existe nos testes. O store grava `surtoAtivo` (número de expiração) mas nunca o resultado da tabela (qual entrada do Surto foi escolhida).

**O que implementar:**
1. Adicionar campo `surtoEscolha: string | null` na interface `Ficha` (types.ts) — guarda o `id` da `EntradaSurto` escolhida (ex: `"fuga-cega"` ou o valor inteiro — a chave primária da entrada).  ou nome pode ser string que guarda o nome da entrada (ex: `"Fuga cega"`).
2. Em `ajustarSanidadeAtual` (store.ts), quando `alerta.surtoDisparado` for true:
   a. Chamar `resolverSurto` passando `Math.floor(Math.random() * 20) + 1` para cada dado (ou pegar de um d20 rolado — idealmente usar a rolagem forçada central, mas isso é item 2).
   b. Se os dois números forem diferentes (`mesmoNumero === false`), exibir modal pro mestre escolher qual entrada vigora (player's choice).
   c. Se `mesmoNumero === true`, não há escolha — usar a entrada direta.
   d. Gravar `surtoEscolha` com o nome da entrada escolhida.
3. No badge da ficha (`AtributosDerivadosSection.tsx:143`), mostrar o nome do efeito:
   - "surto: Fuga cega" em vez de "surto ativo nesta cena"
   - Pode ser: "surto ativo: Fuga cega — [descricao curta]" em tooltip ou span extra.
4. No token overlay e no token 3D, também exibir o nome do efeito se ativo.

**Atenção:** não quebrar o fluxo de combate vs fora de combate já implementado (item 3 original). Apenas adicionar a informação do efeito escolhido.

**Arquivos relevantes:**
- `src/state/types.ts:84` — onde adicionar `surtoEscolha: string | null`
- `src/state/store.ts:163-175` — `ajustarSanidadeAtual` onde o surto dispara
- `src/rules/surto.ts` — `resolverSurto` já implementada, `TABELA_SURTO` em `src/rules/data/surto.ts`
- `src/features/fichas/sections/AtributosDerivadosSection.tsx:140-146` — badge do surto
- `src/features/mapa/MapaTab.tsx:210` — token surto
- `src/tokens3d/TokenScene.tsx:123` — pulso 3D

**Resolvido em 19/07:**
- `types.ts`/`factories.ts` — `Ficha.surtoEscolha: string | null`; migração v4→v5 preenche `null` em fichas antigas.
- `store.ts` — `ajustarSanidadeAtual` rola 2d20 (`Math.random()`, mesma categoria de rolagem de bastidor do item 3 — não é rolagem física, ver nota do item 2) e chama `resolverSurto` quando o Surto dispara. Empate: grava `surtoEscolha` na hora e loga "o destino insiste". Sem empate: guarda em `escolhaSurtoPendente` (novo estado efêmero) até o mestre resolver.
- `SurtoEscolhaModal.tsx` (novo, montado em `App.tsx`) — aparece quando há escolha pendente, mostra as duas entradas lado a lado, `resolverEscolhaSurtoPendente(lado)` grava a escolhida e loga.
- `RoladorSurto.tsx` (o rolador manual, aba Dados) também grava `surtoEscolha` nos dois caminhos (empate e escolha) — as duas formas de disparar Surto (automática e manual) ficam consistentes.
- `AtributosDerivadosSection.tsx` — badge mostra `surto: {nome}` quando resolvido, `surto ativo — aguardando escolha` enquanto pendente.
- `MapaTab.tsx` — tooltip do token inclui o nome do efeito quando ativo.
- Testado ao vivo: os dois caminhos (empate automático e escolha via modal) — badge, log e `escolhaSurtoPendente` conferidos.

## 12. Token overlay compacto com info completa do personagem

**Contexto:** hoje `TokenOverlay.tsx` (abre ao clicar no token do mapa) mostra só nome, PV, Sanidade e Determinação para PCs. O mestre precisa abrir a ficha inteira pra ver traumas, itens, armas, acessos, neuro-regulador.

**O que implementar:** um painel compacto no `TokenOverlay` que exibe tudo numa só linha/info densa. Layout sugerido (320px de largura, texto pequeno):

```
Nome do Personagem                [×]

PV: 14/18  San: 9/24  Det: ●●○
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
⚠ surto: Fuga cega
⚠ trauma: Paranoia (mostrar só trauma e o gatilho)
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
acessos: 3  ⚡ neuro-regulador: genérico (sessão 5)
itens: bisturi, luvas descartáveis, caderno
armas: Faca (1d6), Pistola (2d6/20m)
proteção: Colete discreto (+1 defesa)
```

**Regras de layout:**
- Manter os steppers de PV e Sanidade da implementação atual (botões +/-).
- Separadores opcionais com `╌` ou linha fina.
- Se não houver surto/trauma ativo, não mostrar a linha (nem o separador vazio).
- `neuro-regulador`: mostrar "ativo" se `reguladores.length > 0` (última dose), ou "anestesia ativa" se `anestesiaAte !== null`, ou "nenhum".
- `itens`: texto de `outrosItens` (string livre), truncado com `…` se >60 chars.
- `armas`: nomes separados por vírgula, cada uma com dano entre parênteses. Se mais de 3, mostrar "Faca, Pistola, +2".
- `proteção`: calcular de `equipamentoModificadorDefesa` — usar a tabela `PROTECOES` (src/rules/data/armas.ts) para exibir nome amigável, ou mostrar `+{defesa}` genérico.
- Tamanho: ainda 320px de largura, mas verticalmente compacto (que caiba sem scroll na maioria das telas).

**Arquivos relevantes:**
- `src/features/mapa/TokenOverlay.tsx` — o componente a modificar
- `src/features/mapa/MapaTab.tsx` — onde `TokenOverlay` é usado
- `src/state/types.ts` — tipos `Ficha`, `TraumaFicha`, `ArmaFicha`, `DoseRegulador`
- `src/features/fichas/sections/ArmasSection.tsx` — exemplo de como renderizar armas no ficha editor (referência de layout)
- `src/rules/surto.ts` — `personagemEstaEmSurto` (já importada)
- `src/rules/data/armas.ts` — `PROTECOES` tabela pra resolver nome de proteção por bônus

**Resolvido em 19/07:**
- `TokenOverlay.tsx` reescrito: mantém os steppers de PV/Sanidade e a Determinação; separador fino (`border-top`, não ASCII) antes de surto/trauma (só aparece se houver algum ativo) e antes do bloco de itens/armas/proteção.
- Badges de surto (nome do efeito) e trauma (nome + gatilho) reaproveitando `.badge`/`personagemEstaEmSurto` — sem ⚠ (arte.md proíbe emoji na UI).
- `resumoArmas`/`resumoProtecao`/`resumoRegulador`/`truncar` (funções puras no próprio arquivo): armas com dano entre parênteses (até 3, "+N" se mais), proteção resolvida pela tabela `PROTECOES`, neuro-regulador seguindo a regra exata do doc (anestesia > última dose > nenhum), itens truncados em 60 caracteres.
- `NOMES_TIPO_REGULADOR` exportado de `ReguladoresSection.tsx` (era local, reaproveitado aqui pra não duplicar os 3 nomes de tipo).
- Testado ao vivo: painel mostrando PV 35/35, Sanidade 4/10, badge "surto: Congelamento", badge de trauma sorteado, arma "Faca (1d6 + Vigor)".
