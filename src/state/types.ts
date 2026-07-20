import type { Atributo, GrauPericia } from '../rules/data/pericias';
import type { BasePV, NivelDificuldade } from '../rules/data/dificuldades';

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

  reguladores: DoseRegulador[];
  acessos: number; // telemetria acumulada — o mestre "gasta na pior hora"
  anestesiaAte: string | null; // ISO timestamp, null = sem anestesia ativa

  dinheiroReal: number;
  dinheiroPonto: number;

  anotacoes: string;

  /** nº da cena (sessaoPublica.contadorCena) em que o Surto disparou; null = sem Surto ativo.
   *  Marcador válido enquanto === sessaoPublica.contadorCena — avançar cena invalida sozinho,
   *  sem precisar limpar ficha por ficha (mesa-estatica-multiplayer-completo.md Parte II §2). */
  surtoAtivo: number | null;
  /** nome da entrada da Tabela de Surto em vigor (ex: "Fuga cega") — null enquanto não rolado/
   *  escolhido, ou sem Surto ativo. correcoes-parte2.md item 11. */
  surtoEscolha: string | null;
}

export interface Npc {
  id: string;
  nome: string;
  corVisual: string;
  pvAtual: number;
  pvMaximo: number;
  defesa: number;
  agilidade: number; // pra Iniciativa (d20 + Agilidade, regras.md Parte V)
  notas: string;
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
  timestamp: string; // ISO
  tipo: TipoLog;
  personagemId: string | null;
  texto: string;
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
}

export interface EventoSessao {
  id: string;
  texto: string;
  feito: boolean;
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

export interface GradeMapa {
  ativa: boolean;
  x: number; // % de .mapa-area, canto superior esquerdo
  y: number; // %
  largura: number; // %
  altura: number; // %
  colunas: number; // nº de células na horizontal, >=1
  linhas: number; // nº de células na vertical, >=1
}

export interface EstadoMapa {
  imagemDataUrl: string | null;
  tokens: TokenMapa[];
  grade: GradeMapa;
}

export interface EstadoGlobal {
  schemaVersion: number;
  sessaoPublica: SessaoPublica;
  sessaoPrivada: SessaoPrivada;
  fichas: Ficha[];
  fichaAtivaId: string | null;
  npcs: Npc[];
  iniciativa: EntradaIniciativa[];
  mapa: EstadoMapa;
  log: EntradaLog[];
  config: EstadoConfig;
}
