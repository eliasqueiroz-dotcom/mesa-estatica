# Prompt — Redesign do Overlay de Combate (inspirado no Turn Tracker do Roll20)

## Referência: o que o Roll20 faz de certo

O Turn Tracker do Roll20 (pesquisado antes deste prompt) resolve o mesmo problema que temos — muito combatente, pouco espaço — com um padrão simples: **lista compacta em linha**, não cards grandes expandidos por padrão. Cada entrada é uma linha fina: identidade + valor de iniciativa. Só a informação de "quem está agindo agora" recebe destaque visual forte (o Roll20 até centraliza o mapa no token ativo). Reordenar é arrastar e soltar. É esse princípio — **compacto por padrão, expandido só onde importa** — que guia o redesign abaixo, adaptado pro nosso conjunto de dados (PV, Defesa, condições), que é mais rico que o do Roll20.

## Estrutura geral do painel

```
┌─────────────────────────────────────────┐
│ COMBATE · Rodada 2              [x]      │
├─────────────────────────────────────────┤
│ [Resetar]   [Rolar Inic.]   [Iniciar]    │
├─────────────────────────────────────────┤
│ [x] 1 ▶ Wagner Ginji   ▮▮▮▮▮▮▯▯ 25/30 🛡14│  ← ativo, expandido
│         [Exposto][Caído][Mirando]...     │
├───────────────────────────────────────── │
│ [x] 2   Igor Moraes    ▮▮▮▮▮▮▮▮ 35/40 🛡12│  ← colapsado
├───────────────────────────────────────── │
│ [x] 3   Guarda 1        ▮▮▮▯▯▯▯▯ 12/20 🛡10│  ← colapsado
├─────────────────────────────────────────┤
│ + Adicionar combatente                   │
└─────────────────────────────────────────┘
```

## Especificação por elemento

### 1. Barra de ação (ordem nova, já combinada)
`Resetar` → `Rolar Inic.` → `Iniciar`, nessa ordem da esquerda pra direita.

- **Resetar**: contorno vermelho sujo (ação destrutiva), sempre visível.
- **Rolar Inic.**: **oculto/apagado por padrão**. Só fica visível com contorno azul (mesmo tom do "Iniciar") depois que **pelo menos um** personagem for marcado na lista de "Adicionar combatente" (item 5). Antes disso, não há o que rolar.
- **Iniciar**: contorno azul preenchido, estilo já existente, sempre visível.

### 2. Linha de combatente — colapsada (padrão)

Uma linha só, altura fixa e baixa:

`[x]` `número` `▶/nome` `barra de PV fina + número` `ícone de escudo + valor de Defesa`

- **`[x]` na borda esquerda**, primeiro elemento da linha (posição de fechar aba de navegador) — remove o combatente do combate.
- PV: barra fina horizontal (não os botões `-`/`+` aqui) + número ao lado (`25/30`). Cor da barra segue o estado (verde/âmbar/vermelho conforme a fração de PV restante, coerente com a paleta já usada em "Ferido").
- **Defesa**: ícone de escudo pequeno + valor, ao lado do PV. Estático (não editável na linha colapsada).
- Toque/clique na linha (fora do `x`) expande ela.

### 3. Linha de combatente — expandida (só quem está ativo, ou quem foi tocado manualmente)

Abaixo da linha compacta, aparece uma segunda linha só quando expandido:

- Toggles de condição (Exposto/Caído/Mirando/Escondido/Coberto/Surpresa) — mantém o comportamento de clique que já existe (feedback visual ao ativar, não mexer nisso).
- PV aqui sim mostra os botões `-`/`+` pra ajuste rápido (na linha colapsada, não).
- Defesa aqui pode ficar editável (caso equipamento mude a Defesa em combate), com um `-`/`+` pequeno também, ou um campo numérico direto.

**Regra de expansão:** o combatente cuja vez é agora (`ordem[indice_atual]`) expande **automaticamente**. Os outros ficam colapsados por padrão, mas o jogador/mestre pode tocar em qualquer linha pra expandir/colapsar manualmente sem mudar de quem é a vez.

### 4. Divisórias
Linha fina (1px, tom sutil da paleta) entre cada combatente, substituindo o espaço em branco atual — reduz o respiro vertical sem perder a separação visual.

### 5. "Adicionar combatente" — colapsável
Vira um botão `+ Adicionar combatente` que expande a lista de checkboxes (PCs/NPCs disponíveis) só quando clicado, em vez de ocupar espaço fixo sempre visível. Esse é o mesmo check que, ao marcar o primeiro item, ativa o botão "Rolar Inic." (item 1).

### 6. Indicador de "quem está agindo agora"
Inspirado no Roll20: a linha do combatente ativo recebe destaque visual forte — borda/glow na cor de acento ciano da paleta, mais um ícone `▶` antes do nome (como no diagrama acima). Não precisa centralizar o mapa nele (isso é mais relevante pro Roll20 por causa da navegação de mapa deles), mas o destaque visual precisa ser inequívoco de relance.

### 7. Defesa também no overlay do token (fora do painel de Combate)
O overlay que abre ao clicar num token no mapa (ficha rápida com PV/Sanidade/Determinação) precisa **também mostrar a Defesa** — hoje não mostra. Mesmo formato: ícone de escudo + valor, ao lado do PV, tanto pra PC quanto pra NPC.

## Fora de escopo deste prompt (mencionar mas não implementar agora)
Reordenação por arrastar (drag-and-drop) da lista de turnos, como o Roll20 tem — é um "nice to have" real, mas não é crítico pra concisão do painel. Deixar como item futuro se sobrar tempo.
