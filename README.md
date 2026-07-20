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
npx serve dist     # servidor local, funciona sem internet
```

## Transferindo o estado da mesa (fichas, log, mapa)

O estado vive no **localStorage do navegador** — ele **não** viaja com o git nem com a pasta. Para migrar de máquina (ou de navegador):

1. Na máquina antiga: botão de **export JSON** ("imprimir tudo") → salva um arquivo.
2. Leve o arquivo junto com o projeto.
3. Na máquina nova: **import JSON** → tudo de volta.

Exporte um backup **sempre** antes de migrar e antes de cada sessão. Confie no papel, não na nuvem.

## Comandos

| Comando | Faz |
|---|---|
| `npm run dev` | desenvolvimento (hot reload) |
| `npm run build` | gera `dist/` estático |
| `npx serve dist` | serve o build offline |
| `npm run setup` | recopia os assets 3D do dice-box |
| `npm test` | testes do motor de regras |

## Documentação

- [ROADMAP.md](ROADMAP.md) — plano de construção, dia a dia
- [.claude/docs/regras.md](.claude/docs/regras.md) — regras do jogo (fonte da verdade)
- [.claude/docs/arquitetura.md](.claude/docs/arquitetura.md) — decisões técnicas
- [.claude/docs/arte.md](.claude/docs/arte.md) — direção de arte

## Checklist do dia da sessão (25/07)

- [ ] `npm run build` + `npx serve dist` funcionando **offline** (desligar wifi e testar)
- [ ] Export JSON de backup salvo fora do navegador
- [ ] Fichas dos jogadores conferidas contra as fichas de papel deles
- [ ] Mapa(s) do caso já importado(s), NPCs pré-cadastrados
- [ ] Discord: compartilhar a **janela** do navegador (não a tela), 1080p, modo "otimizar para vídeo" desligado
- [ ] Determinação de todos resetada para 1 ("abrir turno")
- [ ] d20 físico na mesa por garantia — *fé no rolador do navegador, mas o papel não esquece*

## Observações de sessão (18/07/2026)

- Correção aplicada na navegação de abas da shell principal: a aba "Dados & Regras" não deve desmontar ao trocar para "Personagens" e voltar. O problema raiz era renderização condicional que desmontava `DadosTab`, zerando estados locais (`useState`) e o container da bandeja física.
- Ajuste adotado: manter o componente montado e trocar somente a visibilidade com `display` na aba principal. Isso preserva a seleção em Surto/Trauma e o estado visual da mesa de dados.
- Verificação: `npm run build` passou após a correção (`vite build` concluído com sucesso).

## Observações de sessão (18/07/2026 — refinamento de registro e telemetria)

- O log da sessão agora aceita filtros por personagem, por tipo de evento e por texto livre, deixando o histórico legível mesmo em cenas longas.
- A rolagem livre passou a registrar sua saída no log, com o mesmo fluxo de persistência dos outros roladores.
- O contador de acessos (telemetria) agora fica mais explícito na ficha de reguladores, com ajuste manual rápido do mestre para controlar o rastreio por personagem.
- Resultado verificado em build: `npm run build` concluiu com sucesso após a integração destes ajustes.

## Observações de sessão (19/07/2026)

- Correções do `correcoes-parte2.md`: item 5 (renomeio ruído → ruído sanidade + badges de severidade nos gauges + ruído narrativo com estática craquelê e glitch), itens 6-9 (exportar, largura da sessão, textarea maiores, paleta 10 cores, NPC com RGB livre, iniciais nos tokens).
- Item 1 (aviso vazando entre fichas) corrigido com `key={fichaAtiva.id}` no `FichaEditor`.
- Item 3 (Surto) parcial: função compartilhada `personagemEstaEmSurto` criada em `rules/surto.ts`, duração em combate (1d4+1 rodadas) implementada, mas aguarda validação visual.
- Nav das abas agora mostra bolinha indicadora de conteúdo (log com registros, NPCs cadastrados, sessão em andamento, etc.) e tooltip com atalho de teclado.
- Painel de rolagem rápida exibe dica dos atalhos R/S/X.
