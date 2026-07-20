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

1. Na máquina antiga: botão **exportar** (export JSON) → salva um arquivo.
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

Histórico de sessões de trabalho: ver [ROADMAP.md](ROADMAP.md) (resumo por dia) e `git log` (detalhe por commit).
