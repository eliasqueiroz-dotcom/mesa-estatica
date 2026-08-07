import type { Atributo, GrauPericia } from '../rules/data/pericias';
import type { BasePV, NivelDificuldade } from '../rules/data/dificuldades';
import type { EntradaSurto } from '../rules/data/surto';

export interface Vinculo {
  id: string;
  quemOuOque: string;
  frase: string;
}

export interface TraumaFicha {
  id: string;
  nome: string;
  gatilho: string;
  resposta: string;
  virouCicatriz: boolean;
  cicatrizUsadaNestaSessao: boolean;
}

export interface EscolhaSurtoPendente {
  nomeFicha: string;
  entradaA: EntradaSurto;
  entradaB: EntradaSurto;
}

export interface SurtoAtivo {
  id: string;
  expiraEm: number;
  escolha: string | null;
}

export interface KitInvestigacaoItem {
  id: string;
  nome: string;
  nota: string;
}

export interface ArmaFicha {
  id: string;
  nome: string;
  bonusAtaque: string;
  dano: string;
  alcance: string;
  nota: string;
}

export type TipoRegulador = 'generico' | 'pleno' | 'ajuste';

export interface DoseRegulador {
  id: string;
  data: string; // ISO
  sessao: number;
  tipo: TipoRegulador;
}

export interface Ficha {
  id: string;
  corVisual: string;
  /** data URL (JPEG, ~256px) do upload de foto — null = fallback iniciais+cor (Avatar.tsx). */
  foto: string | null;

  // identidade
  nome: string;
  jogador: string;
  antecedenteId: string | null;
  motivo: string;
  perguntaQueTeDefine: string;
  respostaPergunta: string;
  gancho: string;

  vinculos: Vinculo[]; // máx 3

  atributos: Record<Atributo, number>; // 0-5

  // derivados — pv/sanidade "atual" é a fonte da verdade; "máximo" é sempre calculado
  pvAtual: number;
  sanidadeAtual: number;
  equipamentoModificadorDefesa: number;

  determinacao: number; // 0-2

  pericias: Record<string, GrauPericia>; // chave = DefinicaoPericia.id

  traumas: TraumaFicha[]; // máx 3

  kitAntecedente: string;
  contatoOuRecurso: string;
  contatoUsadoNesteCaso: boolean;
  outrosItens: string;

  armas: ArmaFicha[];
  kitInvestigacao: KitInvestigacaoItem[];

  reguladores: DoseRegulador[];
  acessos: number; // telemetria acumulada — o mestre "gasta na pior hora"
  anestesiaAte: string | null; // ISO timestamp, null = sem anestesia ativa

  dinheiroReal: number;
  dinheiroPonto: number;

  anotacoes: string;
  observacaoCombate: string;

  surtosAtivos: SurtoAtivo[];
}

export interface NpcAcao {
  id: string;
  nome: string;
  bonus: number;
  dano: string;
}

export interface Npc {
  id: string;
  nome: string;
  corVisual: string;
  /** slug de uma silhueta pré-instalada (src/assets/silhuetas/silhuetas.tsx) — null = fallback iniciais+cor. */
  silhueta: string | null;
  /** data URL (JPEG, ~256px) do upload de foto real pelo mestre — precedência sobre `silhueta`; null = cai pra silhueta ou iniciais (Avatar.tsx). */
  foto: string | null;
  pvAtual: number;
  pvMaximo: number;
  defesa: number;
  agilidade: number;
  notas: string;
  visivel: boolean;
  notasMestre: string;
  categoria: string;
  acoes: NpcAcao[];
}

export interface EntradaIniciativa {
  id: string;
  participanteId: string; // Ficha.id ou Npc.id
  tipo: 'pc' | 'npc';
  nome: string;
  valor: number;
}

export interface TokenMapa {
  id: string;
  participanteId: string;
  tipo: 'pc' | 'npc';
  x: number; // 0-1 normalizado
  y: number; // 0-1 normalizado
}

export type TipoLog =
  | 'teste'
  | 'sanidade'
  | 'surto'
  | 'trauma'
  | 'dano'
  | 'cura'
  | 'dinheiro'
  | 'determinacao'
  | 'anotacao'
  | 'rolagem-livre'
  | 'iniciativa';

export interface EntradaLog {
  id: string;
  timestamp: string;
  tipo: TipoLog;
  personagemId: string | null;
  texto: string;
  /** Só setado quando a rolagem associada é privada (mesma semântica de `EntradaRoll.visibilidade`)
   *  — ausente/undefined trata como pública. Sem migração de schema: campo aditivo opcional. */
  visibilidade?: 'publica' | 'privada';
  /** Rodada em que a entrada foi registrada, só quando `modoCombate` estava ligado no momento
   *  (`registrarLog` carimba sozinho). Ausente = fora de combate. Campo aditivo opcional, mesmo
   *  espírito de `visibilidade`. */
  rodada?: number;
}

export interface EntradaRoll {
  id: string;
  timestamp: string;
  origem: string;
  personagemId: string | null;
  formula: string;
  total: number;
  bruto: number;
  visibilidade: 'publica' | 'privada';
}

export interface Progresso {
  atual: number;
  total: number;
}

export interface SessaoPublica {
  nomeDaMesa: string;
  numeroSessao: number;
  clima: string;
  hora: string;
  /** "o que os jogadores veem" (mesa-estatica-multiplayer-completo.md Parte III §2) — já existia. */
  cenaAtual: string;
  caso: string;
  localAtual: string;
  objetivo: string;
  progresso: Progresso;
  atmosfera: string;
  /** contador de cena pro Surto (mesa-estatica-multiplayer-completo.md Parte II §2) — não é `cenaAtual`. */
  contadorCena: number;

  /** Modo combate por turnos (Parte II §4). A ordem em si continua em `EstadoGlobal.iniciativa`
   *  (já existia) — aqui só o estado de "de quem é a vez". */
  modoCombate: boolean;
  indiceAtualTurno: number;
  rodada: number;
  /** Condições de combate por combatente (participanteId → ids de `CONDICOES_COMBATE`). Lembrete
   *  visual pro mestre, não modificador automático (Parte II §4). Limpo ao encerrar o combate. */
  condicoesCombate: Record<string, string[]>;
  /** Duração opcional (em rodadas) por condição ativa — participanteId → condicaoId →
   *  rodadasRestantes. Ausência de entrada = condição manual/persistente (comportamento
   *  original, sem prazo). Decrementa no fim do turno do AFETADO (não de quem aplicou);
   *  chega a 0 → remove a condição sozinha. Limpo ao encerrar o combate, junto de
   *  `condicoesCombate`. */
  condicaoDuracao: Record<string, Record<string, number>>;

  /** Cópia de `sessaoPrivada.ameaca`/`.ruidoNarrativo` (espelhada em `atualizarSessaoPrivada`) —
   *  `sessaoPrivada` continua a fonte de edição do GM. Nunca renderizado como número/gauge pro
   *  jogador (`AlertaOverlayJogador.tsx`), só como efeito visual — mesma régua de `tierDeGauge`
   *  já usada em `AlertaOverlay.tsx`. `tensao` fica de fora de propósito, nunca sobe daqui. */
  ameaca: number;
  ruidoNarrativo: number;
}

export interface EventoSessao {
  id: string;
  texto: string;
  feito: boolean;
}

export type StatusPista = 'nao-descoberta' | 'descoberta' | 'compartilhada';

/** Quadro de pistas/evidências — painel visual do mestre, fora da ficha de personagem. */
export interface Pista {
  id: string;
  texto: string;
  /** NPC, local ou caso relacionado — texto livre. */
  ligadoA: string;
  status: StatusPista;
  criadoEm: string; // ISO
}

export interface Lembrete {
  id: string;
  texto: string;
}

export interface EstatisticasSessao {
  rolagens: number;
  surtos: number;
  /** sem gatilho automático (não há regra de morte em regras.md) — ajustado manualmente. */
  mortes: number;
  /** ISO; null = timer da sessão parado. */
  iniciadaEm: string | null;
}

export interface SessaoPrivada {
  oQueRealmenteAcontece: string;
  proximoEvento: string;
  lembretes: Lembrete[];
  eventos: EventoSessao[];
  tensao: number; // 0-100
  ruidoNarrativo: number; // 0-100
  ameaca: number; // 0-100
  estatisticas: EstatisticasSessao;
  /** DT da cena atual — só o mestre define/vê (nunca aparece nos roladores nem no log). */
  dificuldadeCena: NivelDificuldade;
  dificuldadeCenaCustom: number;
  /** IDs de participante selecionados pra iniciativa (persiste entre sessões). */
  selecionadosIniciativa: string[];
}

export interface EstadoConfig {
  basePV: BasePV;
}

export type UnidadeMedida = 'm' | 'km';

export interface GradeMapa {
  ativa: boolean;
  // % da IMAGEM renderizada (object-fit: contain), não de .mapa-area — container varia por
  // dispositivo (mestre tem .mapa-toolbar acima, jogador não), imagem é o que é compartilhado
  // de verdade entre os dois. Canto superior esquerdo.
  x: number;
  y: number; // %
  largura: number; // %
  altura: number; // %
  colunas: number; // nº de células na horizontal, >=1
  linhas: number; // nº de células na vertical, >=1
  escala: number; // unidades por célula (régua) — ex: 1.5
  unidade: UnidadeMedida;
}

export interface EstadoMapa {
  imagemDataUrl: string | null;
  tokens: TokenMapa[];
  grade: GradeMapa;
  /** Fog of war — máscara de revelação controlada pelo mestre (ROADMAP F1). Persiste entre
   *  sessões (reabrir o mapa segue onde parou) e sincroniza via `fowSync.ts` (migration 0027). */
  fow: EstadoFoW;
}

/** Variante por zona do chiado do FoW (arte.md: --real=rua/analógico, --rede=corporativo).
 *  `null` = P&B puro canal-sem-sinal (default). */
export type ZonaFoW = 'rua' | 'corporativo';

/** Região retangular (v1) — 0-1 normalizado à IMAGEM (mesmo espaço de TokenMapa.x/y, invariante
 *  #3 do ROADMAP). `forma` faz parte do tipo já em v1 pra v2 (polígonos) migrar sem shape break
 *  (acrescentar `'poly'` + `pontos?: Ponto[]` numa futura SCHEMA_VERSION). */
export interface RegiaoFoW {
  id: string;
  forma: 'rect';
  x: number; // 0-1, canto superior esquerdo
  y: number; // 0-1, canto superior esquerdo
  w: number; // 0-1, largura
  h: number; // 0-1, altura
  zona: ZonaFoW | null;
}

export interface EstadoFoW {
  /** já visitado — persiste entre sessões; "memória" corrompida (frame visto com degradação). */
  vistas: RegiaoFoW[];
  /** luz atual — subset de `vistas`; `visiveisAgora ⊆ vistas` sempre que cobrir luz (mantém memória). */
  visiveisAgora: RegiaoFoW[];
  /** próxima região traçada assume essa zona (toolbar GM). Determina matiz do chiado/transition. */
  proximoIdZona: ZonaFoW | null;
  /** liga/desliga só a RENDERIZAÇÃO das 3 camadas — nunca apaga `vistas`/`visiveisAgora`.
   *  Default `false`: mapa nasce limpo, sem forçar fog em cena que não vai usar a ferramenta
   *  (combate, referência). Ligar mostra o mapa inteiro em chiado "nunca visto" até o mestre
   *  revelar algo — desligar e religar preserva tudo que já foi revelado. */
  ativa: boolean;
}

export type ModoLoopMidia = 'nenhum' | 'faixa' | 'lista';

export interface FaixaMidia {
  id: string;
  nome: string;
  /** caminho do objeto dentro do bucket 'midia' do Supabase Storage. */
  path: string;
  /** URL pública já resolvida no upload (bucket público — sem expiração). */
  url: string;
  ordem: number;
  criadoEm: string; // ISO
}

export interface EstadoMidia {
  faixas: FaixaMidia[];
  faixaAtualId: string | null;
  tocando: boolean;
  posicaoSegundos: number;
  /** ISO — timestamp do último push do GM; base do cálculo de posição esperada nos outros
   *  clientes (ver src/multiplayer/posicaoMidia.ts). */
  atualizadoEm: string;
  modoLoop: ModoLoopMidia;
  /** Só o GM ajusta (slider em MidiaTab.tsx) — sincronizado pra todo mundo ouvir no mesmo
   *  nível. Mudo continua local a cada jogador (MidiaPlayerJogador.tsx), não faz parte disso. */
  volume: number;
}

/** Um dos 6 botões do soundpad. `slot` (0–5) é a identidade de posição na grade. */
export interface SomSoundpad {
  id: string;
  slot: number;
  nome: string;
  path: string;
  url: string;
}

export interface EstadoSoundpad {
  sons: SomSoundpad[];
  /** Separado do volume da música — o GM controla os dois de forma independente. */
  volume: number;
  /** Evento, não estado: quem recebe compara `em` com o último disparo já tocado e só toca
   *  se for mais novo, senão um refetch do Realtime repetiria o efeito. */
  ultimoDisparo: { slot: number; em: string } | null;
}

export interface EstadoGlobal {
  schemaVersion: number;
  sessaoPublica: SessaoPublica;
  sessaoPrivada: SessaoPrivada;
  fichas: Ficha[];
  fichaAtivaId: string | null;
  npcs: Npc[];
  pistas: Pista[];
  iniciativa: EntradaIniciativa[];
  mapa: EstadoMapa;
  midia: EstadoMidia;
  soundpad: EstadoSoundpad;
  log: EntradaLog[];
  rollsLog: EntradaRoll[];
  config: EstadoConfig;
}
