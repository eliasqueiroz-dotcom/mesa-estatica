import type { Atributo, GrauPericia } from '../rules/data/pericias';
import type { BasePV } from '../rules/data/dificuldades';

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
}

export interface Npc {
  id: string;
  nome: string;
  pvAtual: number;
  pvMaximo: number;
  defesa: number;
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
  | 'rolagem-livre';

export interface EntradaLog {
  id: string;
  timestamp: string; // ISO
  tipo: TipoLog;
  personagemId: string | null;
  texto: string;
}

export interface EstadoSessao {
  nomeDaMesa: string;
  numeroSessao: number;
  cenaAtual: string;
  clima: string;
  hora: string;
}

export interface EstadoConfig {
  basePV: BasePV;
}

export interface EstadoMapa {
  imagemDataUrl: string | null;
  tokens: TokenMapa[];
}

export interface EstadoGlobal {
  schemaVersion: number;
  sessao: EstadoSessao;
  fichas: Ficha[];
  fichaAtivaId: string | null;
  npcs: Npc[];
  iniciativa: EntradaIniciativa[];
  mapa: EstadoMapa;
  log: EntradaLog[];
  config: EstadoConfig;
}
