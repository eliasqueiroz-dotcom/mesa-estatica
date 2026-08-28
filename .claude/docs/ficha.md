# Estática — Especificação da Ficha de Personagem

> Espelha a `estatica-ficha.docx` campo a campo. Tudo editável; cálculos automáticos onde indicado.
> Correções sobre o plano original: **15 perícias** (não 14 — inclui Erudição), Ferido aplica **-2 mecânico**, dinheiro inicial **R$ 500 + P$ 800**, e a ficha oficial rastreia **doses de Pleno®** — o plano tinha ignorado isso.

## Identidade

| Campo | Tipo |
|---|---|
| Nome | texto |
| Jogador(a) | texto |
| Antecedente | select (os 8 do guia + "Outro (escrever)" — ao escolher um preset, oferecer preencher perícias + kit; nunca sobrescrever sem confirmar; "Outro" libera campo de texto livre) |
| Motivo | texto ("por que você investiga o que todos fingem não ver") |
| Pergunta que te define + resposta | texto |

## Vínculos (máx. 3; 3º marcado "reservado à progressão")

Lista de até 3: `quem/o quê` + `uma frase`.
Lembrete na UI: cena de Vínculo no downtime +1d4 Sanidade · perder Vínculo -1d8 direto.

## Atributos

Vigor · Agilidade · Intelecto · Percepção · Presença · Vontade — inteiros 0–5.
Hint de criação: array 3,2,2,1,1,0 · máx. 3 na criação.

## Derivados (calculados; "atual" editável)

| Valor | Fórmula | Campos |
|---|---|---|
| PV | `basePV + 5×Vigor` (basePV configurável 10/20/30, padrão 20 — dial de letalidade) | máx. auto + atual editável |
| Sanidade | `10 + 5×Vontade` | máx. auto + atual editável |
| Defesa | `10 + Agilidade + equipamento` (equipamento = modificador manual) | auto |
| Alerta | `10 + Percepção` | auto |

### Indicadores automáticos (com efeito mecânico, não só cor)

- **Ferido**: PV atual ≤ ⌊máx/2⌋ → badge + **-2 em testes de Vigor e Agilidade** (o rolador deve aplicar automaticamente e mostrar no detalhamento da soma).
- **Linha da Sanidade**: mostrar o valor da metade (⌊máx/2⌋). Quando Sanidade atual cruzar essa linha **descendo**, alertar: "Marque um Trauma" (detecção por transição, não por estado — só dispara no cruzamento).
- **Perda ≥5 de uma vez** → alertar: "SURTO — role duas vezes na tabela" com atalho pro rolador de Surto.
- **3+ Traumas ativos** → aviso "à beira de se perder".

## Determinação

2 checkboxes (máx. 2). Botão "nova sessão" reseta para 1.
Tooltip com as condições de ganho/gasto (ver regras.md).

## Perícias — grid fixo das 15, agrupadas por atributo

Cada uma: toggle `— / Treinado (+3) / Veterano (+6)`.

- **Vigor**: Atletismo, Briga
- **Agilidade**: Pontaria, Furtividade, Condução
- **Intelecto**: Tecnologia, Medicina, Erudição, Ocultismo
- **Percepção**: Investigação, Intuição, Rua
- **Presença**: Persuasão, Enganação, Intimidação

Cada linha de perícia tem botão de rolagem direta (d20 + atributo + grau, com Ferido aplicado se ativo).

## Traumas e Cicatrizes (até 3 linhas)

`nome` + `gatilho (detalhe específico)` + `resposta` + toggle `virou Cicatriz`.
- Botão "sortear na tabela" (d20 na tabela de 20 Traumas) ou escolha manual.
- Em cena: botão "gatilho apareceu" → rola Vontade DT 12 do personagem; em falha, apresenta a escolha (-1d4 Sanidade **ou** interpretar + 1 Determinação).
- Cicatriz: lembrete "1×/sessão: +2 quando o tema for relevante" com checkbox de uso por sessão.

## Equipamento

- Kit do Antecedente (texto, pré-preenchido pelo preset)
- Contato ou Recurso (texto + checkbox "usado neste caso" — uma cena por caso; pedir demais queima)
- Outros itens (texto livre)

## Armas (tabela livre + presets)

Colunas: `nome` · `bônus de ataque (d20 + ...)` · `dano` · `alcance` · `nota`.
Botão "adicionar do arsenal" com as 9 armas do guia pré-cadastradas (ver regras.md). Rolagem de ataque e de dano direto da linha; corpo a corpo soma Vigor ao dano automaticamente.

## Neuro-reguladores (a ficha oficial rastreia isso — o plano original ignorou)

- Registro de doses: data/sessão + tipo (Genérico / Pleno® / Ajuste).
- **Contador de Acessos** (telemetria — o mestre "gasta na pior hora"): Genérico 0 · Pleno® +1 · Ajuste +3.
- Flag automática de **Dependência**: doses em 2 sessões consecutivas → badge "Dependente (-2 Vontade sem dose há 1+ dia)".
- Flag de **Anestesia** ("até dormir"): enquanto ativa, a UI marca que gatilhos de Trauma passam automático sem gerar Determinação, Vínculo não recupera Sanidade e Motivo não gera Determinação.

## Dinheiro

Dois contadores independentes com botões rápidos (+1, +10, +100, -1, -10, -100 e valor custom):
- **R$ (papel — a rua)** — estilizar no acento âmbar/analógico
- **P$ (Ponto® — a rede, rastreada)** — estilizar no acento ciano/corporativo

Início de jogo: R$ 500 + P$ 800 (default de ficha nova).
Atalho de conversão com cambista: P$→R$ aplica -30%.

## Anotações do caso

Textarea livre por personagem. Placeholder in-world: "Escreva tudo — confie no papel, não na nuvem."

## Comportamento geral

- Autosave contínuo (localStorage) — sem botão de salvar.
- Toda mudança de PV/Sanidade/Determinação/dinheiro gera entrada no Log da sessão (com delta e origem).
- Mudanças manuais de "atual" também passam pela detecção de Ferido/linha da Sanidade/Surto.
