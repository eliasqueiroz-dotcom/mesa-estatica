import type { Atributo } from '../rules/data/pericias';
import type { EstadoGlobal, Ficha, GradeMapa, Npc, SessaoPrivada, SessaoPublica } from './types';

const gerarId = () => crypto.randomUUID();

const ATRIBUTOS_ZERO: Record<Atributo, number> = {
  vigor: 0,
  agilidade: 0,
  intelecto: 0,
  percepcao: 0,
  presenca: 0,
  vontade: 0,
};

/** paleta curada — Ficha escolhe daqui (SeletorCor), nunca RGB livre (arte.md). */
export const CORES_PERSONAGEM = [
  '#4fc1d4', '#c99a5a', '#8b7cd8', '#6bb37a', '#d47a9e', '#d4a54f',
  '#a8463e', '#5a7d9a', '#d48c4a', '#3a8a7a',
];

/** cor padrão de NPC — neutra, distinta da paleta viva de PC até o mestre customizar. */
export const COR_NPC_PADRAO = '#7d8594';

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
    surtoAtivo: null,
  };
}

export function criarNpcVazio(): Npc {
  return {
    id: gerarId(),
    nome: '',
    corVisual: COR_NPC_PADRAO,
    pvAtual: 10,
    pvMaximo: 10,
    defesa: 10,
    agilidade: 1,
    notas: '',
  };
}

export function criarGradeInicial(): GradeMapa {
  return { ativa: false, x: 0, y: 0, largura: 100, altura: 100, colunas: 10, linhas: 10 };
}

export function criarSessaoPublica(): SessaoPublica {
  return {
    nomeDaMesa: 'Estática',
    numeroSessao: 1,
    clima: 'garoa',
    hora: '',
    cenaAtual: '',
    caso: '',
    localAtual: '',
    objetivo: '',
    progresso: { atual: 0, total: 0 },
    atmosfera: '',
    contadorCena: 1,
    modoCombate: false,
    indiceAtualTurno: 0,
    rodada: 1,
  };
}

export function criarSessaoPrivada(): SessaoPrivada {
  return {
    oQueRealmenteAcontece: '',
    proximoEvento: '',
    lembretes: [],
    eventos: [],
    tensao: 0,
    ruidoNarrativo: 0,
    ameaca: 0,
    estatisticas: { rolagens: 0, surtos: 0, mortes: 0, iniciadaEm: null },
  };
}

export const SCHEMA_VERSION = 4;

export function criarEstadoInicial(): EstadoGlobal {
  return {
    schemaVersion: SCHEMA_VERSION,
    sessaoPublica: criarSessaoPublica(),
    sessaoPrivada: criarSessaoPrivada(),
    fichas: [],
    fichaAtivaId: null,
    npcs: [],
    iniciativa: [],
    mapa: { imagemDataUrl: null, tokens: [], grade: criarGradeInicial() },
    log: [],
    config: { basePV: 20 },
  };
}
