import { describe, expect, it } from 'vitest';
import {
  COR_NPC_PADRAO,
  CORES_PERSONAGEM,
  criarEstadoInicial,
  criarEstadoMidia,
  criarFichaVazia,
  criarGradeInicial,
  criarNpcAcao,
  criarNpcVazio,
  criarSessaoPrivada,
  criarSessaoPublica,
  SCHEMA_VERSION,
} from './factories';

describe('criarFichaVazia', () => {
  it('valores-padrão que importam pro jogo: PV 20, Sanidade 10, dinheiro R$500/P$800, determinação 1', () => {
    const ficha = criarFichaVazia();
    expect(ficha.pvAtual).toBe(20);
    expect(ficha.sanidadeAtual).toBe(10);
    expect(ficha.dinheiroReal).toBe(500);
    expect(ficha.dinheiroPonto).toBe(800);
    expect(ficha.determinacao).toBe(1);
    expect(ficha.atributos).toEqual({ vigor: 0, agilidade: 0, intelecto: 0, percepcao: 0, presenca: 0, vontade: 0 });
    expect(ficha.foto).toBeNull();
    expect(ficha.surtosAtivos).toEqual([]);
  });

  it('cor vem da paleta curada, por índice, com wraparound', () => {
    expect(criarFichaVazia(0).corVisual).toBe(CORES_PERSONAGEM[0]);
    expect(criarFichaVazia(CORES_PERSONAGEM.length).corVisual).toBe(CORES_PERSONAGEM[0]);
    expect(criarFichaVazia(1).corVisual).toBe(CORES_PERSONAGEM[1]);
  });

  it('cada chamada gera um id único', () => {
    expect(criarFichaVazia().id).not.toBe(criarFichaVazia().id);
  });
});

describe('criarNpcVazio', () => {
  it('valores-padrão: PV/PV máximo/defesa 10, agilidade 1, oculto dos jogadores, sem foto/silhueta', () => {
    const npc = criarNpcVazio();
    expect(npc.pvAtual).toBe(10);
    expect(npc.pvMaximo).toBe(10);
    expect(npc.defesa).toBe(10);
    expect(npc.agilidade).toBe(1);
    expect(npc.visivel).toBe(false);
    expect(npc.corVisual).toBe(COR_NPC_PADRAO);
    expect(npc.silhueta).toBeNull();
    expect(npc.foto).toBeNull();
    expect(npc.acoes).toEqual([]);
  });
});

describe('criarNpcAcao', () => {
  it('ação vazia com bônus 0', () => {
    const acao = criarNpcAcao();
    expect(acao.nome).toBe('');
    expect(acao.bonus).toBe(0);
    expect(acao.dano).toBe('');
  });
});

describe('criarGradeInicial', () => {
  it('grade desativada, 10x10, escala 1.5m', () => {
    const grade = criarGradeInicial();
    expect(grade.ativa).toBe(false);
    expect(grade.colunas).toBe(10);
    expect(grade.linhas).toBe(10);
    expect(grade.escala).toBe(1.5);
    expect(grade.unidade).toBe('m');
  });
});

describe('criarSessaoPublica', () => {
  it('mesa "Estática", sessão 1, garoa, fora de combate', () => {
    const sessao = criarSessaoPublica();
    expect(sessao.nomeDaMesa).toBe('Estática');
    expect(sessao.numeroSessao).toBe(1);
    expect(sessao.clima).toBe('garoa');
    expect(sessao.modoCombate).toBe(false);
    expect(sessao.rodada).toBe(1);
    expect(sessao.condicoesCombate).toEqual({});
    expect(sessao.condicaoDuracao).toEqual({});
  });
});

describe('criarSessaoPrivada', () => {
  it('dificuldade de cena padrão "media" (DT custom 15), sem estatísticas ainda', () => {
    const sessao = criarSessaoPrivada();
    expect(sessao.dificuldadeCena).toBe('media');
    expect(sessao.dificuldadeCenaCustom).toBe(15);
    expect(sessao.estatisticas).toEqual({ rolagens: 0, surtos: 0, mortes: 0, iniciadaEm: null });
    expect(sessao.selecionadosIniciativa).toEqual([]);
  });
});

describe('criarEstadoMidia', () => {
  it('sem faixa tocando, volume 0.8, sem loop', () => {
    const midia = criarEstadoMidia();
    expect(midia.faixas).toEqual([]);
    expect(midia.faixaAtualId).toBeNull();
    expect(midia.tocando).toBe(false);
    expect(midia.volume).toBe(0.8);
    expect(midia.modoLoop).toBe('nenhum');
  });
});

describe('criarEstadoInicial', () => {
  it('schemaVersion bate com SCHEMA_VERSION atual, mesa vazia (sem fichas/npcs/tokens)', () => {
    const estado = criarEstadoInicial();
    expect(estado.schemaVersion).toBe(SCHEMA_VERSION);
    expect(estado.fichas).toEqual([]);
    expect(estado.npcs).toEqual([]);
    expect(estado.fichaAtivaId).toBeNull();
    expect(estado.mapa).toEqual({ imagemDataUrl: null, tokens: [], grade: criarGradeInicial(), fow: { vistas: [], visiveisAgora: [], proximoIdZona: null, ativa: false } });
    expect(estado.config).toEqual({ basePV: 20 });
  });
});
