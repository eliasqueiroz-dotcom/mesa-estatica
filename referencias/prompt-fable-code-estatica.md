# Prompt para o Fable Code — Mesa Virtual de "Estática"

> Copie tudo abaixo e envie junto com os dois anexos: `estatica-guia-do-jogador.pdf` e `estatica-ficha.docx`. O agente precisa dos dois pra extrair regras e campos exatos — não resumi tudo aqui de propósito, é pra ele ler a fonte.

---

## 1. Contexto

Vou mestrar uma sessão de "Estática" (RPG de investigação/horror ambientado numa São Paulo distópica-corporativa, sistema d20 + atributo + perícia) daqui a uma semana. Preciso de uma ferramenta única que eu — o mestre — vou controlar sozinho na minha tela e compartilhar por screen share no Discord. Os jogadores **não** acessam a ferramenta; eles só veem minha tela e ouvem minha voz.

Isso significa: zero necessidade de sincronização multiplayer, zero autenticação, zero servidor de aplicação. Estado persistido localmente (localStorage), rodando no meu navegador.

## 2. O que NÃO quero

- Não é um clone de Tabletop Simulator com física 3D no tabuleiro inteiro. É um painel de controle de mestre com **um** momento físico de destaque: os dados.
- Não quero um template genérico de "RPG dark fantasy" com fonte serifada + textura de pergaminho batida. Isso é o padrão que toda IA entrega — quero o oposto.
- Não quero abas soltas sem coerência visual. A ferramenta inteira precisa parecer que pertence ao mundo do jogo, não uma dashboard de admin genérica com skin escura.

## 3. Direção de arte — isso é o que vai fazer a diferença

O nome do jogo já é a proposta visual: **Estática é o mundo parado, o Ruído é o que se move por baixo.** A interface deve literalmente encarnar isso.

**Conceito central (elemento de assinatura):** a interface tem uma camada sutil de ruído/estática visual (grain, scanlines, leve chroma-aberration) que é quase imperceptível em estado normal — mas que **se intensifica visualmente conforme a Sanidade da ficha ativa cai**. A UI "surta" junto com o personagem. Isso não é decoração, é a mecânica do jogo virando linguagem visual. É o único efeito ousado no resto da interface — o painel de dados 3D (seção 4) é o segundo momento de destaque; o resto deve ser disciplinado e funcional pra não competir com os dois.

**Paleta (nomeie e use estes tons como base, ajuste livremente):**
- Fundo profundo: um quase-preto com leve dessaturação azulada (a "estática" por trás de tudo), não um preto puro.
- Superfícies/painéis: cinza-concreto frio, referência ao Eixo corporativo (Paulista/Faria Lima/Berrini).
- Acento "Ponto® / corporativo": um azul-ciano frio e clínico — usado em elementos de sistema, botões de ação corporativa, tudo que é "rede", "rastreado".
- Acento "Real / analógico": um âmbar/sépia quente de papel velho — usado em anotações, dinheiro em espécie, tudo que é "fora da rede".
- Alerta/dano/Sanidade crítica: um vermelho sujo, não saturado — nada de vermelho-Ferrari genérico.

**Tipografia:**
- Uma fonte condensada/industrial tipo sinalização corporativa para headers, labels de sistema e UI chrome (referência: crachás, catracas, "Sinal limpo.", "Pode dormir.").
- Uma fonte monoespaçada (tipo terminal/máquina de escrever) para o log de dados, anotações de caso e qualquer coisa "analógica" — reforça a dualidade rede vs. papel do próprio jogo.
- Nada de serifa clássica decorativa "medieval". O jogo se passa amanhã, não na idade média.

**Evite os três clichês de design gerado por IA:** fundo creme + serifa + terracota; preto + verde-neon único; layout jornal com hairlines. Se o resultado parecer qualquer um desses três, refaça.

## 4. Elementos 3D — dados e tokens

Dois elementos com renderização/física 3D de verdade, sobre uma base 2D. É o momento que meus jogadores vão sentir na tela durante o screen share — o resto da interface continua disciplinado (ver seção 2).

### 4.1 Dados físicos 3D — 100% aleatórios, sem determinismo

Rolagem fisicamente simulada em 3D (dados caindo, quicando, assentando) e o resultado precisa ser genuinamente aleatório, gerado pela própria física, não forçado. Isso simplifica a implementação, não complica: rolagem determinística exigiria código extra pra "mentir" de forma convincente; rolagem honesta é o comportamento padrão da biblioteca.

**Recomendação técnica: use a biblioteca `@3d-dice/dice-box-threejs`** (Three.js para renderização + Cannon-es para física). Ela já resolve o problema difícil — geometria dos poliedros, física de queda, detecção de qual face ficou pra cima — e evita reinventar isso do zero em uma semana. Pontos que interessam especificamente pra este projeto:

- Suporta todos os dados do sistema: d4, d6, d8, d10, d12, d20, d100.
- Rolagem nativa e honesta: o valor final é o que a física realmente produziu. O motor de regras (seção 7) soma atributo + perícia **em cima** desse valor bruto depois que o dado assenta — matemática do sistema separada da física do dado.
- Suporta temas de material (`glass`, `metal`, `wood`, `plastic`) e colorset customizado — reskinar pra combinar com a paleta da seção 3 (ex: dados com acabamento "vidro corporativo" ciano pra testes normais, e um tema mais sujo/âmbar pra rolagens de Sanidade/Surto).
- Expõe callback `onRollComplete` — plugue direto no log da sessão (seção 7).

### 4.2 Tokens de personagem em 3D sobre o mapa 2D

O mapa continua 2D — o que fica 3D são os próprios tokens. Nada de modelar um personagem por jogador (isso sozinho comeria a semana); a saída realista é um **token geométrico** renderizado em Three.js, posicionado sobre as coordenadas do mapa 2D:

- Forma sugerida: um cristal/chip facetado (baixo poli) com a cor e a inicial do personagem, leve rotação contínua e flutuação sutil — reforça a estética "crachá corporativo/beacon de rastreamento" do mundo do jogo.
- Reaproveita a mesma cena/renderer dos dados (seção 4.1) — não é uma segunda stack técnica.
- Arrastar o token continua sendo a lógica 2D já planejada (pointerdown/pointermove/pointerup) — o que muda é só a camada visual: em vez de uma `div` colorida, o que se move é a posição de um objeto Three.js projetado sobre o mapa.
- Sanidade crítica de um personagem pode refletir no próprio token (ex: o cristal treme ou perde faces), reforçando o conceito de assinatura da seção 3.

**Camada opcional — rosto escaneado dos jogadores:** os jogadores podem escanear o próprio rosto com um app gratuito de photogrammetry no celular (ex: RealityScan ou KIRI Engine, ambos iOS/Android, exportam `.glb`) e mandar o arquivo pro mestre, que o coloca numa pasta local `assets/faces/` referenciada por personagem. Se o `.glb` existir pra aquele personagem, o token carrega o mesh escaneado; se não existir (jogador não escaneou a tempo, ou o scan saiu ruim), cai automaticamente no token geométrico padrão com — se houver uma foto simples do rosto disponível — essa foto aplicada como textura numa placa plana, com um shader de scanline/glitch por cima, simulando um crachá de identificação holográfico. Esse fallback não é "plano B pobre": ele encaixa direto na estética de vigilância corporativa do jogo, então nenhum dos dois caminhos foge do tom da mesa.

**Trade-off técnico a avisar:** essa biblioteca carrega assets (texturas, modelos) como arquivos estáticos, então o app deixa de ser um único `.html` isolado e passa a ser uma pasta pequena servida localmente (um `npx serve` ou `vite` local resolve, ainda 100% offline, sem backend de verdade). Vale a troca pelo resultado visual. Se em algum ponto da semana isso ameaçar o prazo: corte primeiro os tokens 3D (volta pra `div` colorida) antes dos dados 3D — os dados são usados a cada teste, os tokens são estáticos a maior parte do tempo.

## 5. Estrutura da ferramenta

Um app de uma página com navegação por abas (sem reload). Ordem sugerida:

1. **Sessão** (tela inicial): nome da mesa, contador de sessão, dados climáticos/de cena rápidos (a garoa, a hora), campo de "cena atual" que eu edito ao vivo.
2. **Personagens**: uma ficha completa por jogador, ver seção 6.
3. **Dados & Regras Rápidas**: o canvas 3D da seção 4, integrado com o rolador de teste (d20 + atributo + perícia vs DT), rolador de Surto, e uma cola visual das mecânicas de combate.
4. **Mapa**: tabuleiro 2D com upload de imagem de fundo e tokens 3D arrastáveis (ver seção 4.2 — o arrasto é lógica 2D simples, só a renderização do token é 3D).
5. **NPCs & Iniciativa**: lista rápida de NPCs/inimigos com PV, Defesa, e uma tabela de iniciativa ordenável (d20 + Agilidade).
6. **Log da sessão**: histórico cronológico de rolagens, mudanças de PV/Sanidade e anotações — serve de registro pós-sessão.

## 6. Ficha de personagem — campos exatos (ver `estatica-ficha.docx` para o layout original)

Reproduza fielmente, com cálculo automático onde indicado:

- **Identidade:** Nome, Jogador(a), Antecedente, Motivo, Pergunta que te define + resposta.
- **Vínculos:** até 3 (2 na criação), campo "quem/o quê" + frase.
- **Atributos:** Vigor, Agilidade, Intelecto, Percepção, Presença, Vontade (0–5, inputs numéricos).
- **Valores derivados (calcular automaticamente a partir dos atributos):**
  - PV máximo = 20 + 5×Vigor (com campo editável pra "atual")
  - Sanidade máxima = 10 + 5×Vontade (com campo editável pra "atual")
  - Defesa = 10 + Agilidade + equipamento (equipamento como modificador manual)
  - Alerta = 10 + Percepção
  - Indicador visual automático de "Ferido" quando PV atual ≤ metade do máximo
  - Indicador visual automático de "cruzou a metade da Sanidade descendo" → deve marcar Trauma
- **Determinação:** dois checkboxes (máx. 2), começa a sessão em 1.
- **Perícias:** grid fixo com as 14 perícias do jogo (Atletismo, Briga, Pontaria, Furtividade, Condução, Tecnologia, Medicina, Ocultismo, Investigação, Intuição, Rua, Persuasão, Enganação, Intimidação), cada uma com toggle Treinado (+3) / Veterano (+6) / nenhum, agrupadas por atributo.
- **Traumas e Cicatrizes:** tabela de até 3, campo gatilho + resposta + toggle "virou Cicatriz".
- **Equipamento:** kit do antecedente, contato/recurso, outros itens (texto livre).
- **Armas:** tabela livre (nome, bônus de ataque, dano, alcance).
- **Dinheiro:** dois contadores separados, R$ (papel) e P$ (Ponto®), com botões de incrementar/decrementar rápidos (isso é usado o tempo todo em jogo).
- **Anotações do caso:** área de texto livre por personagem.

## 7. Motor de regras — implemente de verdade, não só decorativo

- **Teste padrão:** botão de rolagem que soma d20 + atributo selecionado + grau de perícia (0/+3/+6) contra uma DT escolhida (10/15/20/25, com opção de DT customizada). O resultado numérico já vem calculado e é passado como valor determinístico pro dado 3D (seção 4) — a física do d20 "revela" o resultado que já foi calculado. A UI indica automaticamente: sucesso/falha, "margem de 10+" (efeito extra), 20 natural (sucesso com margem garantida), 1 natural (falha + complicação).
- **Teste de Sanidade:** botão separado que rola a perda (1d4 perturbador / 1d8 horror direto / 2d8 impossível) e aplica direto no campo de Sanidade atual do personagem selecionado, com opção de "sucesso = metade" vs "falha = total".
- **Surto:** botão que rola 1d20 duas vezes na tabela de Surto (reproduza a tabela completa do guia) e me mostra os dois resultados lado a lado pra eu escolher qual acontece (ou indicar automaticamente quando os dois números baterem — "o destino insiste").
- **Log automático:** toda rolagem cai no log da sessão (seção 5.6) com timestamp, personagem e resultado.

## 8. Requisitos técnicos

- App local, sem backend de aplicação. Se a lib de dados 3D exigir servir arquivos estáticos, um comando simples de servidor local (`npx serve .` ou `vite`) é aceitável — só documente o comando pra eu não travar tentando abrir o arquivo direto no navegador.
- Estado persistido automaticamente (localStorage) — preciso poder fechar o navegador e reabrir sem perder nada.
- Performance: precisa ser fluido em screen share, sem travar ao arrastar tokens, trocar de aba ou rolar os dados 3D.
- Fallback: se a internet cair no meio da sessão, tudo exceto talvez o carregamento inicial de fontes web precisa continuar funcionando (self-host das fontes é mais seguro que CDN).
- Atalhos de teclado para as ações mais usadas durante a sessão (ex: rolar d20 rápido) são bem-vindos, mas não essenciais.

## 9. Cronograma sugerido (1 semana)

1. **Dias 1–2:** modelo de dados completo + ficha de personagem funcional (todos os campos da seção 6, cálculos automáticos).
2. **Dia 3:** motor de regras (testes, Sanidade, Surto) + log — sem o visual 3D ainda, só a lógica e um número na tela.
3. **Dia 4:** integração do `dice-box-threejs` para os dados (rolagem física honesta + reskin de material/cor) — validado isoladamente antes de tocar no mapa.
4. **Dia 5:** tokens 3D sobre o mapa 2D (seção 4.2), reaproveitando a stack do dia 4, + NPCs/iniciativa + aba de sessão.
5. **Dias 6–7:** identidade visual completa (seção 3) aplicada em tudo + playtest sozinho simulando uma cena inteira, com folga real pro dia 7 caso o dia 4 ou 5 estoure.

Ordem de corte se o tempo apertar: 1º NPCs/Iniciativa (vira lista simples) → 2º tokens 3D (volta pra `div` colorida) → identidade visual (seção 3) e dados 3D não se cortam, são o que diferencia isso de uma ferramenta genérica.

## 10. Fase 2 — se sobrar tempo (não faz parte do escopo principal)

Isto só começa depois que as seções 1–9 estiverem prontas e testadas. Não entra na semana como requisito — é upside, não meta.

**Cenas de abertura em 3D gerado por IA:** usar o **Marble** (World Labs) pra gerar 1–2 ambientes atmosféricos do mundo de Estática — o Eixo corporativo, uma Zona, o Metrô abandonado — a partir de descrição textual ou de uma imagem de referência. Exportar como vídeo curto (não como cena navegável) e usar como "plano de abertura" antes de uma cena importante — tipo uma cutscene de poucos segundos, sem interação e sem substituir o mapa 2D funcional das seções 5 e 6.

**Por que é fase 2 e não parte do escopo:** um mapa 3D de verdade navegável (câmera livre, colisão, iluminação em tempo real) é uma categoria de projeto diferente — dias de engenharia de engine, não algo que se encaixa no que já está planejado. Isso aqui é só um vídeo de ambientação, gerado à parte, sem nenhuma dependência técnica do resto da ferramenta. Se não sobrar tempo, a sessão roda normalmente sem essas cenas.

## 11. Critério de aceite

Antes de me entregar, se pergunte: se eu mostrar isso pra alguém que já viu dez ferramentas de RPG feitas por IA, ela vai reconhecer a cara de "gerado rápido"? Se sim, o problema quase certamente está na seção 3 (identidade visual) não ter sido levada a sério — isso pesa mais que qualquer feature extra, inclusive mais que os dados 3D.
