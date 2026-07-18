# Estática — Direção de Arte

> A tese: **a Estática é o mundo parado; o Ruído é o que se move por baixo.** A interface encarna isso.
> Dois momentos ousados, e só dois: (1) o sistema de ruído ligado à Sanidade, (2) os dados 3D. Todo o resto é disciplinado, denso e funcional — um instrumento de trabalho do mestre, não uma landing page.

## Os três clichês proibidos (critério de rejeição)

Se o resultado parecer qualquer um destes, refazer:
1. Fundo creme + serifa + terracota ("editorial IA 2024")
2. Preto + um único verde-neon ("hacker genérico")
3. Layout jornal com hairlines e serifa display

Teste do espelho: alguém que já viu dez ferramentas de RPG feitas por IA olha e pensa "gerado rápido"? Então falhou — e o problema é aqui, não nas features.

## Design tokens (CSS custom properties — fonte da verdade em `src/styles/tokens.css`)

```css
:root {
  /* fundos — quase-preto azulado dessaturado, nunca #000 */
  --void:        #0b0d11;  /* fundo profundo da página */
  --concrete-0:  #14171d;  /* painel base */
  --concrete-1:  #1c2028;  /* painel elevado / cards */
  --concrete-2:  #262b35;  /* bordas, divisores, inputs */

  /* texto */
  --ink:         #c6ccd6;  /* texto padrão — nunca branco puro */
  --ink-dim:     #7d8594;  /* secundário, labels */
  --ink-faint:   #4a515e;  /* desabilitado, placeholders */

  /* acento REDE (Ponto®, sistema, rastreado) — ciano clínico frio */
  --rede:        #4fc1d4;
  --rede-dim:    #2a6d78;
  --rede-glow:   rgba(79, 193, 212, 0.12);  /* únicos glows permitidos */

  /* acento REAL (papel, analógico, fora da rede) — âmbar sépia */
  --real:        #c99a5a;
  --real-dim:    #6e5636;
  --real-paper:  #d8c9a8;  /* texto sobre superfícies "analógicas" */

  /* alerta / dano / Sanidade crítica — vermelho sujo, dessaturado */
  --ruido:       #a8463e;
  --ruido-dim:   #5c2d29;
}
```

Regra de uso: **ciano = rede/sistema/corporativo** (P$, testes, botões de sistema, chrome). **Âmbar = analógico/humano** (R$, anotações, log manuscrito, Vínculos). **Vermelho sujo = só dano, Sanidade crítica e Surto.** Nunca usar os três juntos no mesmo componente.

## Tipografia (self-host via @fontsource — nada de CDN, a sessão não pode depender de internet)

| Papel | Fonte | Uso |
|---|---|---|
| Display / headers / chrome de UI | **Barlow Condensed** (600/700, caps, tracking largo) | títulos de aba, labels de sistema, botões — cara de sinalização corporativa/crachá |
| Corpo / formulários | **Barlow** (400/500) | campos da ficha, textos correntes |
| Terminal / analógico | **IBM Plex Mono** (400/600) | log da sessão, anotações do caso, valores de dados, timestamps, dinheiro |

Proibido: serifa decorativa, fontes "medievais", Inter/Roboto por preguiça no display.

## O sistema de ruído (elemento de assinatura)

Uma camada global de estática que responde à **Sanidade da ficha ativa** (razão atual/máx). Implementar por **tiers discretos** (não contínuo — evita repaint constante e dá momentos legíveis de virada):

| Tier | Sanidade | Efeito |
|---|---|---|
| 0 — Limpo | > 75% | grain estático quase imperceptível (opacity ~0.03) |
| 1 — Interferência | 50–75% | grain um pouco mais denso + scanlines sutis |
| 2 — Ruído | 25–50% (cruzou a linha do Trauma) | grain animado, scanlines visíveis, chroma aberration leve nos headers (text-shadow duplo rede/ruído deslocado 1px) |
| 3 — Colapso | ≤ 25% | tudo acima + glitch ocasional (transform skew de 1–2 frames a cada 8–15s, via keyframes com steps()) + vinheta |
| Surto (transitório) | ao disparar Surto | burst de 1,5s de estática forte que decai para o tier atual |

Implementação: um único `<div>` fixo, `pointer-events: none`, acima de tudo; grain via SVG `feTurbulence` inline (data-URI, sem asset externo); scanlines via repeating-linear-gradient; animações só com `transform`/`opacity`. Tier vira um atributo `data-ruido="0..3"` no `<html>` — CSS puro decide o resto.

Discrição: o efeito **nunca** pode atrapalhar leitura de números da ficha em tier ≤ 2. Tier 3 pode incomodar de leve — é o ponto.

## Microcopy — a interface fala a língua do mundo

Isto é o que separa "ferramenta com skin" de "objeto do mundo do jogo". Exemplos canônicos (usar/estender):

- Log vazio: `sem registros. sinal limpo.`
- Autosave: indicador discreto `● registrado` (mono, ciano) — nunca "Saved!"
- Rolagem no log: `[23:41:07] HELENA · Percepção+Investigação vs DT15 → 14+5 = 19 ✓ margem 4`
- Sucesso com margem 10+: `margem 10+ — efeito extra`
- 1 natural: `1 natural — complicação`
- Surto com números iguais: `o destino insiste.`
- Sanidade caindo pra tier 2: toast `a garoa chia.`
- Botão de nova sessão: `abrir turno`
- Backup/export: `imprimir tudo — confie no papel, não na nuvem`
- Deletar ficha (confirmação): `apagar da rede? o papel não esquece.`
- P$: sempre `P$` com ®  em contexto formal (`Ponto®`); R$ sempre associado a "papel/rua"

Tom: frases curtas, minúsculas no log (estética terminal), sem exclamações, sem emoji. Headers em CAPS condensado.

## Componentes — decisões rápidas

- **Densidade**: é painel de mestre pra screen share — informação densa, hierarquia por peso/cor, não por espaço em branco de sobra. Corpo 14–15px; log 13px mono.
- **Abas**: barra superior estilo terminal/crachá — label CAPS condensado + atalho numérico (`1 SESSÃO · 2 FICHAS · 3 DADOS · 4 MAPA · 5 NPCS · 6 LOG`).
- **Cantos**: raio pequeno (2–4px) ou zero. Nada de rounded-2xl amigável.
- **Sombras**: quase nenhuma; elevação por borda `--concrete-2` e diferença de fundo. Glow só em `--rede-glow` para foco/ação primária.
- **Barras de PV/Sanidade**: retas, segmentadas (ticks a cada 5), com a **linha da metade marcada** — Sanidade rotulada como `NÍVEL DE RUÍDO` invertido visualmente (quanto menos sanidade, mais a barra "chia" com textura).
- **Dados 3D**: bandeja com dois colorsets — `rede` (vidro frio ciano, testes normais) e `ruído` (âmbar sujo/vermelho, Sanidade e Surto).
- **Tokens de personagem**: cristal/chip facetado low-poly, cor do personagem + inicial, rotação lenta; com Sanidade tier 3 o cristal ganha jitter. Fallback de rosto: placa com foto + shader scanline = crachá holográfico (estética de vigilância — não é plano B pobre).
- **Ícones**: traço fino, geométricos, consistentes (Lucide serve, stroke 1.5) — nunca emoji na UI.
