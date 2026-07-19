import type { Atributo } from '../rules/data/pericias';
import type { EstadoGlobal, Ficha, Npc } from './types';

const gerarId = () => crypto.randomUUID();

const ATRIBUTOS_ZERO: Record<Atributo, number> = {
  vigor: 0,
  agilidade: 0,
  intelecto: 0,
  percepcao: 0,
  presenca: 0,
  vontade: 0,
};

const CORES_PERSONAGEM = ['#4fc1d4', '#c99a5a', '#8b7cd8', '#6bb37a', '#d47a9e', '#d4a54f'];

export function criarFichaVazia(corIndex = 0): Ficha {
  return {
    id: gerarId(),
    corVisual: CORES_PERSONAGEM[corIndex % CORES_PERSONAGEM.length],
    nome: '',
    jogador: '',
    antecedenteId: null,
    motivo: '',
    perguntaQueTeDefine: '',
    respostaPergunta: '',
    gancho: '',
    vinculos: [],
    atributos: { ...ATRIBUTOS_ZERO },
    pvAtual: 20,
    sanidadeAtual: 10,
    equipamentoModificadorDefesa: 0,
    determinacao: 1,
    pericias: {},
    traumas: [],
    kitAntecedente: '',
    contatoOuRecurso: '',
    contatoUsadoNesteCaso: false,
    outrosItens: '',
    armas: [],
    reguladores: [],
    acessos: 0,
    anestesiaAte: null,
    dinheiroReal: 500,
    dinheiroPonto: 800,
    anotacoes: '',
  };
}

export function criarNpcVazio(): Npc {
  return {
    id: gerarId(),
    nome: '',
    pvAtual: 10,
    pvMaximo: 10,
    defesa: 10,
    agilidade: 1,
    notas: '',
  };
}

export const SCHEMA_VERSION = 1;

export function criarEstadoInicial(): EstadoGlobal {
  return {
    schemaVersion: SCHEMA_VERSION,
    sessao: {
      nomeDaMesa: 'Estática',
      numeroSessao: 1,
      cenaAtual: '',
      clima: 'garoa',
      hora: '',
    },
    fichas: [],
    fichaAtivaId: null,
    npcs: [],
    iniciativa: [],
    mapa: { imagemDataUrl: null, tokens: [] },
    log: [],
    config: { basePV: 20 },
  };
}
