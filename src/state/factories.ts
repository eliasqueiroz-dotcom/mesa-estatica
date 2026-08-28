import type { Atributo } from '../rules/data/pericias';
import { criarTabelasSeed } from '../rules/data/tabelasSeed';
import type { EstadoFoW, EstadoGlobal, EstadoMidia, EstadoSoundpad, Ficha, GradeMapa, Npc, NpcAcao, Pista, SessaoPrivada, SessaoPublica } from './types';

export { criarTabelasSeed };

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
    foto: null,
    nome: '',
    jogador: '',
    antecedenteId: null,
    antecedenteCustom: '',
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
    kitInvestigacao: [],
    reguladores: [],
    acessos: 0,
    anestesiaAte: null,
    dinheiroReal: 500,
    dinheiroPonto: 800,
    anotacoes: '',
    observacaoCombate: '',
    surtosAtivos: [],
  };
}

export function criarNpcAcao(): NpcAcao {
  return { id: gerarId(), nome: '', bonus: 0, dano: '' };
}

export function criarNpcVazio(): Npc {
  return {
    id: gerarId(),
    nome: '',
    corVisual: COR_NPC_PADRAO,
    silhueta: null,
    foto: null,
    pvAtual: 10,
    pvMaximo: 10,
    defesa: 10,
    agilidade: 1,
    notas: '',
    visivel: false,
    notasMestre: '',
    categoria: '',
    acoes: [],
  };
}

export function criarPistaVazia(): Pista {
  return { id: gerarId(), texto: '', ligadoA: '', status: 'nao-descoberta', criadoEm: new Date().toISOString() };
}

export function criarGradeInicial(): GradeMapa {
  return { ativa: false, x: 0, y: 0, largura: 100, altura: 100, colunas: 10, linhas: 10, escala: 1.5, unidade: 'm' };
}

/** Fog of war vazio — nenhuma região revelada, desligado por padrão (mestre liga por mapa). */
export function criarFoWVazio(): EstadoFoW {
  return { vistas: [], visiveisAgora: [], zonaAtual: null, ativa: false };
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
    turnoAtualId: null,
    rodada: 1,
    condicoesCombate: {},
    condicaoDuracao: {},
    ameaca: 0,
    ruidoNarrativo: 0,
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
    dificuldadeCena: 'media',
    dificuldadeCenaCustom: 15,
    selecionadosIniciativa: [],
  };
}

export function criarEstadoMidia(): EstadoMidia {
  return {
    faixas: [],
    faixaAtualId: null,
    tocando: false,
    posicaoSegundos: 0,
    atualizadoEm: new Date(0).toISOString(),
    modoLoop: 'nenhum',
    volume: 0.8,
  };
}

export function criarEstadoSoundpad(): EstadoSoundpad {
  return { sons: [], volume: 0.8, ultimoDisparo: null };
}

export const SCHEMA_VERSION = 33;

export function criarEstadoInicial(): EstadoGlobal {
  return {
    schemaVersion: SCHEMA_VERSION,
    sessaoPublica: criarSessaoPublica(),
    sessaoPrivada: criarSessaoPrivada(),
    fichas: [],
    fichaAtivaId: null,
    npcs: [],
    pistas: [],
    iniciativa: [],
    mapa: { imagemDataUrl: null, tokens: [], grade: criarGradeInicial(), fow: criarFoWVazio() },
    midia: criarEstadoMidia(),
    soundpad: criarEstadoSoundpad(),
    log: [],
    rollsLog: [],
    tabelas: criarTabelasSeed(),
    config: { basePV: 20 },
  };
}
