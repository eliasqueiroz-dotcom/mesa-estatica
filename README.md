# Mesa de Estática

Painel de controle do mestre para o RPG **Estática** — ficha viva, motor de regras, dados 3D físicos, mapa com tokens. Roda 100% local, sem backend; feito para uma tela só (a do mestre) compartilhada por screen share no Discord.

> *A Estática é o mundo parado. O Ruído é o que se move por baixo.*

## Rodando em uma máquina nova (transferência)

Este projeto foi feito para ser portátil — a máquina de desenvolvimento **não** é a máquina da sessão. Num computador novo:

**Pré-requisitos** (uma vez só):
- [Node.js LTS](https://nodejs.org) (no Windows: `winget install OpenJS.NodeJS.LTS`)
- Um navegador com WebGL (Chrome/Edge/Firefox atuais — qualquer um serve)

**Instalação**:

```bash
git clone <repo>   # ou copie a pasta inteira (sem node_modules)
cd "RPG Estatica"
npm install        # o postinstall copia os assets 3D dos dados automaticamente
npm run dev        # abre em http://localhost:5173
```

Se os dados 3D não aparecerem (pasta `public/assets/dice-box-threejs/` vazia), rode `npm run setup` — é o mesmo script do postinstall, manualmente.

**Para o dia da sessão (offline)**:

```bash
npm run build
npm run preview    # vite preview, serve dist/ localmente sem internet
```

## Abas

| # | Aba | Função |
|---|---|---|
| 1 | Sessão | dashboard público/privado: cena, clima, turno, gauges de ruído/ameaça/tensão, eventos |
| 2 | Personagens | fichas completas com atributos, perícias, traumas, equipamento, neuro-reguladores, dinheiro |
| 3 | Dados & Regras | bandeja 3D com roladores de Teste, Sanidade, Surto, Trauma e Rolagem Livre |
| 4 | Mapa | upload de imagem, tokens arrastáveis (cristal 3D), grid, overlays de combate |
| 5 | NPCs & Iniciativa | cadastro de NPCs com ações roláveis, tabela de iniciativa ordenada |
| 6 | Log | registro narrativo + rolagens, com filtros por personagem/tipo/busca |

## Atalhos de teclado

| Tecla | Ação |
|---|---|
| `1`–`6` | troca de aba |
| `R` | abre a rolagem rápida (d20) e já rola |
| `S` | abre a rolagem rápida sem rolar |
| `X` | fecha a rolagem rápida |

Ignorados enquanto o foco está num campo de texto.

## Transferindo o estado da mesa (fichas, log, mapa)

O estado vive no **localStorage do navegador** — ele **não** viaja com o git nem com a pasta. Para migrar de máquina (ou de navegador):

1. Na máquina antiga: botão **exportar** (export JSON) → salva um arquivo.
2. Leve o arquivo junto com o projeto.
3. Na máquina nova: **import JSON** → tudo de volta.

Exporte um backup **sempre** antes de migrar e antes de cada sessão. Confie no papel, não na nuvem.

## Janela de controle secreta

Clique no título "Estática — Mesa" para abrir uma janela separada (`#controle`) com a **fila de rolagem forçada**. O padrão é honesto; valores enfileirados aqui fazem o dado cair no resultado escolhido, indistinguível na tela. Mantenha **fora** da janela compartilhada no Discord.

## Sistema de ruído

A Sanidade da ficha ativa controla uma camada visual de estática global:

| Tier | Sanidade | Efeito |
|---|---|---|
| 0 — Limpo | > 75% | grain quase imperceptível |
| 1 — Interferência | 50–75% | grain + scanlines sutis |
| 2 — Ruído | 25–50% | grain animado, chroma aberration nos headers |
| 3 — Colapso | ≤ 25% | glitch, vinheta, skew |

Surto dispara um burst de 1,5s que decai para o tier atual.

## Comandos

| Comando | Faz |
|---|---|
| `npm run dev` | desenvolvimento (hot reload) |
| `npm run build` | gera `dist/` estático |
| `npm run preview` | serve o build localmente |
| `npm run setup` | recopia os assets 3D do dice-box |
| `npm test` | testes do motor de regras (vitest) |
| `npm run test:watch` | testes em modo watch |

## Documentação

- [ROADMAP.md](ROADMAP.md) — plano de construção, dia a dia
- [.claude/docs/regras.md](.claude/docs/regras.md) — regras do jogo (fonte da verdade)
- [.claude/docs/ficha.md](.claude/docs/ficha.md) — especificação campo a campo da ficha
- [.claude/docs/arquitetura.md](.claude/docs/arquitetura.md) — decisões técnicas
- [.claude/docs/arte.md](.claude/docs/arte.md) — direção de arte

## Checklist do dia da sessão (25/07)

- [ ] `npm run build` + `npm run preview` funcionando **offline** (desligar wifi e testar)
- [ ] Export JSON de backup salvo fora do navegador
- [ ] Fichas dos jogadores conferidas contra as fichas de papel deles
- [ ] Mapa(s) do caso já importado(s), NPCs pré-cadastrados
- [ ] Discord: compartilhar a **janela** do navegador (não a tela), 1080p, modo "otimizar para vídeo" desligado
- [ ] Determinação de todos resetada para 1 ("abrir turno")
- [ ] d20 físico na mesa por garantia — *fé no rolador do navegador, mas o papel não esquece*
