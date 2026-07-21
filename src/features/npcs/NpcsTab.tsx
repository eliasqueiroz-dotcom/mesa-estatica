import { useEffect, useRef, useState } from 'react';
import { calcularDefesa, calcularPvMaximo } from '../../rules/derivados';
import { CONDICOES_COMBATE } from '../../rules/data/condicoesCombate';
import { personagemEstaEmSurto, type EstadoSessaoParaSurto } from '../../rules/surto';
import { criarNpcAcao } from '../../state/factories';
import { useStore } from '../../state/store';
import type { NpcAcao } from '../../state/types';
import './npcs.css';

interface PvCombatente {
  atual: number;
  maximo: number;
  aplicar: (delta: number) => void;
}

function corPv(atual: number, maximo: number): string {
  if (atual <= maximo * 0.25) return 'var(--ruido)';
  if (atual <= maximo * 0.5) return 'var(--real)';
  return 'var(--rede)';
}

function rolarD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

function rolarDano(danoFormula: string): number {
  const match = danoFormula.match(/^(\d+)d(\d+)(?:\+(\d+))?$/i);
  if (!match) return 0;
  const qtd = parseInt(match[1], 10);
  const faces = parseInt(match[2], 10);
  const mod = match[3] ? parseInt(match[3], 10) : 0;
  let total = 0;
  for (let i = 0; i < qtd; i++) total += Math.floor(Math.random() * faces) + 1;
  return total + mod;
}

function InlineAcaoEditor({ acao, onSalvar, onCancelar }: {
  acao: NpcAcao;
  onSalvar: (patch: Partial<NpcAcao>) => void;
  onCancelar: () => void;
}) {
  const [nome, setNome] = useState(acao.nome);
  const [bonus, setBonus] = useState(acao.bonus);
  const [dano, setDano] = useState(acao.dano);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', padding: '0.15rem 0' }}>
      <input
        ref={ref}
        type="text"
        placeholder="nome"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        style={{ flex: 2, fontSize: 11, minWidth: 0 }}
      />
      <input
        type="number"
        placeholder="bônus"
        value={bonus}
        onChange={(e) => setBonus(Number(e.target.value) || 0)}
        style={{ flex: 1, fontSize: 11, minWidth: 0, width: 50 }}
        title="bônus de teste (soma direta no d20)"
      />
      <input
        type="text"
        placeholder="dano (opcional)"
        value={dano}
        onChange={(e) => setDano(e.target.value)}
        style={{ flex: 1, fontSize: 11, minWidth: 0 }}
        title="fórmula de dano, ex: 1d6+2"
      />
      <button className="icone-botao acento" onClick={() => onSalvar({ nome, bonus, dano })} style={{ fontSize: 10, padding: '0.2em 0.4em' }}>
        salvar
      </button>
      <button className="icone-botao" onClick={onCancelar} style={{ fontSize: 10, padding: '0.2em 0.4em' }}>
        cancelar
      </button>
    </div>
  );
}

export default function NpcsTab() {
  const [editandoNpcs, setEditandoNpcs] = useState<Set<string>>(new Set());
  const [acaoEditandoId, setAcaoEditandoId] = useState<Record<string, string | null>>({});
  const [filtroCategoria, setFiltroCategoria] = useState('');

  const npcs = useStore((s) => s.npcs);
  const registrarLog = useStore((s) => s.registrarLog);
  const adicionarNpc = useStore((s) => s.adicionarNpc);
  const duplicarNpc = useStore((s) => s.duplicarNpc);
  const atualizarNpc = useStore((s) => s.atualizarNpc);
  const removerNpc = useStore((s) => s.removerNpc);

  const fichas = useStore((s) => s.fichas);
  const iniciativa = useStore((s) => s.iniciativa);
  const rolarIniciativaTodos = useStore((s) => s.rolarIniciativaTodos);
  const rolarIniciativa = useStore((s) => s.rolarIniciativa);
  const removerDaIniciativa = useStore((s) => s.removerDaIniciativa);
  const limparIniciativa = useStore((s) => s.limparIniciativa);
  const reordenarIniciativa = useStore((s) => s.reordenarIniciativa);

  const modoCombate = useStore((s) => s.sessaoPublica.modoCombate);
  const indiceAtualTurno = useStore((s) => s.sessaoPublica.indiceAtualTurno);
  const rodada = useStore((s) => s.sessaoPublica.rodada);
  const contadorCena = useStore((s) => s.sessaoPublica.contadorCena);
  const condicoesCombate = useStore((s) => s.sessaoPublica.condicoesCombate);
  const basePV = useStore((s) => s.config.basePV);
  const iniciarModoCombate = useStore((s) => s.iniciarModoCombate);
  const avancarTurno = useStore((s) => s.avancarTurno);
  const encerrarModoCombate = useStore((s) => s.encerrarModoCombate);
  const ajustarPvAtual = useStore((s) => s.ajustarPvAtual);
  const atualizarFicha = useStore((s) => s.atualizarFicha);
  const alternarCondicaoCombate = useStore((s) => s.alternarCondicaoCombate);

  const selecionadosIniciativa = useStore((s) => s.sessaoPrivada.selecionadosIniciativa);
  const atualizarSessaoPrivada = useStore((s) => s.atualizarSessaoPrivada);

  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [adicionarAberto, setAdicionarAberto] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const categorias = [...new Set(npcs.map((n) => n.categoria ?? '').filter(Boolean))];
  const npcsFiltrados = filtroCategoria ? npcs.filter((n) => (n.categoria ?? '') === filtroCategoria) : npcs;

  const participantesDisponiveis = [
    ...fichas.map((f) => ({ id: f.id, tipo: 'pc' as const, nome: f.nome || 'sem nome' })),
    ...npcs.map((n) => ({ id: n.id, tipo: 'npc' as const, nome: n.nome || 'sem nome' })),
  ];

  const jaNaIniciativa = new Set(iniciativa.map((e) => e.participanteId));
  const disponiveis = participantesDisponiveis.filter((p) => !jaNaIniciativa.has(p.id));
  const nenhumSelecionado = disponiveis.length > 0 && disponiveis.every((p) => !selecionadosIniciativa.includes(p.id));
  const todosSelecionados = disponiveis.length > 0 && disponiveis.every((p) => selecionadosIniciativa.includes(p.id));

  const toggleSelecionado = (id: string) => {
    const novo = selecionadosIniciativa.includes(id)
      ? selecionadosIniciativa.filter((s) => s !== id)
      : [...selecionadosIniciativa, id];
    atualizarSessaoPrivada({ selecionadosIniciativa: novo });
  };

  const toggleTodos = () => {
    if (todosSelecionados) {
      const ids = new Set(disponiveis.map((p) => p.id));
      atualizarSessaoPrivada({ selecionadosIniciativa: selecionadosIniciativa.filter((s) => !ids.has(s)) });
    } else {
      const ids = disponiveis.map((p) => p.id);
      const existentes = new Set(selecionadosIniciativa);
      const novos = ids.filter((id) => !existentes.has(id));
      atualizarSessaoPrivada({ selecionadosIniciativa: [...selecionadosIniciativa, ...novos] });
    }
  };

  const rolarSelecionados = () => {
    const ids = [...new Set(selecionadosIniciativa)];
    if (ids.length === 0) { rolarIniciativaTodos(); return; }
    rolarIniciativa(ids);
    const idsDisponiveis = new Set(disponiveis.map((p) => p.id));
    atualizarSessaoPrivada({ selecionadosIniciativa: selecionadosIniciativa.filter((s) => !idsDisponiveis.has(s)) });
  };

  const resetar = () => {
    atualizarSessaoPrivada({ selecionadosIniciativa: [] });
    setExpandidos(new Set());
    setAdicionarAberto(false);
    if (modoCombate) encerrarModoCombate();
    if (iniciativa.length > 0) limparIniciativa();
  };

  const adicionarDisponiveis = disponiveis.filter((p) => selecionadosIniciativa.includes(p.id));

  const toggleExpandido = (id: string) => {
    setExpandidos((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  };

  const pvDoCombatente = (participanteId: string, tipo: 'pc' | 'npc'): PvCombatente | null => {
    if (tipo === 'pc') {
      const ficha = fichas.find((f) => f.id === participanteId);
      if (!ficha) return null;
      return {
        atual: ficha.pvAtual,
        maximo: calcularPvMaximo(basePV, ficha.atributos.vigor),
        aplicar: (delta) => ajustarPvAtual(ficha.id, ficha.pvAtual + delta),
      };
    }
    const npc = npcs.find((n) => n.id === participanteId);
    if (!npc) return null;
    return {
      atual: npc.pvAtual,
      maximo: npc.pvMaximo,
      aplicar: (delta) => atualizarNpc(npc.id, { pvAtual: npc.pvAtual + delta }),
    };
  };

  const defesaDoCombatente = (participanteId: string, tipo: 'pc' | 'npc'): { valor: number; ajustar: (delta: number) => void } | null => {
    if (tipo === 'pc') {
      const ficha = fichas.find((f) => f.id === participanteId);
      if (!ficha) return null;
      return {
        valor: calcularDefesa(ficha.atributos.agilidade, ficha.equipamentoModificadorDefesa),
        ajustar: (delta) => atualizarFicha(ficha.id, { equipamentoModificadorDefesa: ficha.equipamentoModificadorDefesa + delta }),
      };
    }
    const npc = npcs.find((n) => n.id === participanteId);
    if (!npc) return null;
    return {
      valor: npc.defesa,
      ajustar: (delta) => atualizarNpc(npc.id, { defesa: npc.defesa + delta }),
    };
  };

  const remover = (id: string, nome: string) => {
    const ok = window.confirm(`tirar "${nome || 'sem nome'}" do tabuleiro? não volta.`);
    if (ok) removerNpc(id);
  };

  const novoNpc = () => {
    const id = adicionarNpc();
    setEditandoNpcs((prev) => new Set(prev).add(id));
  };

  const toggleEditando = (id: string) => {
    setEditandoNpcs((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  };

  const abrirNovaAcao = (npcId: string) => {
    setAcaoEditandoId((prev) => ({ ...prev, [npcId]: '__new__' }));
  };

  const fecharEditorAcao = (npcId: string) => {
    setAcaoEditandoId((prev) => {
      const next = { ...prev };
      delete next[npcId];
      return next;
    });
  };

  const salvarNovaAcao = (npcId: string, patch: Partial<NpcAcao>) => {
    const npc = npcs.find((n) => n.id === npcId);
    if (!npc) return;
    const acao = criarNpcAcao();
    atualizarNpc(npcId, { acoes: [...npc.acoes, { ...acao, ...patch }] });
    fecharEditorAcao(npcId);
  };

  const salvarAcao = (npcId: string, acaoId: string, patch: Partial<NpcAcao>) => {
    const npc = npcs.find((n) => n.id === npcId);
    if (!npc) return;
    atualizarNpc(npcId, { acoes: npc.acoes.map((a) => (a.id === acaoId ? { ...a, ...patch } : a)) });
    fecharEditorAcao(npcId);
  };

  const removerAcao = (npcId: string, acaoId: string) => {
    const npc = npcs.find((n) => n.id === npcId);
    if (!npc) return;
    atualizarNpc(npcId, { acoes: npc.acoes.filter((a) => a.id !== acaoId) });
  };

  const usarAcao = (npcNome: string, acao: NpcAcao) => {
    const d20 = rolarD20();
    const total = d20 + acao.bonus;
    const dmg = acao.dano ? rolarDano(acao.dano) : 0;
    const partes = [`${npcNome} · ${acao.nome}`];
    partes.push(`teste d20${acao.bonus >= 0 ? '+' : ''}${acao.bonus} → ${d20}${acao.bonus >= 0 ? '+' : ''}${acao.bonus} = ${total}`);
    if (acao.dano && dmg > 0) partes.push(`dano ${acao.dano} → ${dmg}`);
    registrarLog('rolagem-livre', partes.join(' | '));
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 1fr) minmax(280px, 380px)', gap: '1rem', alignItems: 'start' }}>
      <div className="secao">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>npcs</h3>
          <button className="acento" onClick={novoNpc}>+ novo npc</button>
        </div>

        {categorias.length > 0 && (
          <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="vazio" style={{ fontSize: 11 }}>filtro:</span>
            <button
              className={`combate-chip${!filtroCategoria ? ' combate-chip--ativa' : ''}`}
              onClick={() => setFiltroCategoria('')}
              style={{ fontSize: 10 }}
            >
              todas
            </button>
            {categorias.map((cat) => (
              <button
                key={cat}
                className={`combate-chip${filtroCategoria === cat ? ' combate-chip--ativa' : ''}`}
                onClick={() => setFiltroCategoria(filtroCategoria === cat ? '' : cat)}
                style={{ fontSize: 10 }}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {npcsFiltrados.length === 0 ? (
          <p className="vazio">nenhum npc cadastrado ainda.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {npcsFiltrados.map((n) => {
              const editando = editandoNpcs.has(n.id);
              return (
                <div key={n.id} className="npc-card">
                  {editando ? (
                    <>
                      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <input
                          type="text"
                          placeholder="nome"
                          value={n.nome}
                          onChange={(e) => atualizarNpc(n.id, { nome: e.target.value })}
                          style={{ flex: 1 }}
                        />
                        <input
                          type="color"
                          value={n.corVisual}
                          onChange={(e) => atualizarNpc(n.id, { corVisual: e.target.value })}
                          title="cor do token"
                          style={{ width: 26, height: 26, padding: 0, border: 'none', cursor: 'pointer', background: 'none' }}
                        />
                        <span
                          className="icone-botao"
                          role="button"
                          tabIndex={0}
                          onClick={() => atualizarNpc(n.id, { visivel: !n.visivel })}
                          title={n.visivel ? 'visível aos jogadores' : 'oculto dos jogadores'}
                          style={{ color: n.visivel ? 'var(--rede)' : 'var(--ink-faint)', fontSize: 14 }}
                        >
                          {n.visivel ? '👁' : '👁‍🗨'}
                        </span>
                        <span
                          className="icone-botao"
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleEditando(n.id)}
                          title="fechar edição"
                          style={{ fontSize: 14 }}
                        >
                          ⚙
                        </span>
                        <span
                          className="icone-botao"
                          role="button"
                          tabIndex={0}
                          onClick={() => duplicarNpc(n.id)}
                          title="duplicar"
                          style={{ fontSize: 13 }}
                        >
                          ⊞
                        </span>
                        <span
                          className="icone-botao"
                          role="button"
                          tabIndex={0}
                          onClick={() => remover(n.id, n.nome)}
                          style={{ color: 'var(--ruido)' }}
                        >
                          ×
                        </span>
                      </div>

                      <div className="npc-card__grid">
                        <div>
                          <label htmlFor={`npc-pv-${n.id}`}>PV atual</label>
                          <input id={`npc-pv-${n.id}`} type="number" value={n.pvAtual} onChange={(e) => atualizarNpc(n.id, { pvAtual: Number(e.target.value) || 0 })} />
                        </div>
                        <div>
                          <label htmlFor={`npc-pvmax-${n.id}`}>PV máximo</label>
                          <input id={`npc-pvmax-${n.id}`} type="number" value={n.pvMaximo} onChange={(e) => atualizarNpc(n.id, { pvMaximo: Number(e.target.value) || 0 })} />
                        </div>
                        <div>
                          <label htmlFor={`npc-defesa-${n.id}`}>Defesa</label>
                          <input id={`npc-defesa-${n.id}`} type="number" value={n.defesa} onChange={(e) => atualizarNpc(n.id, { defesa: Number(e.target.value) || 0 })} />
                        </div>
                        <div>
                          <label htmlFor={`npc-agi-${n.id}`}>Agilidade</label>
                          <input id={`npc-agi-${n.id}`} type="number" value={n.agilidade} onChange={(e) => atualizarNpc(n.id, { agilidade: Number(e.target.value) || 0 })} />
                        </div>
                      </div>

                      <textarea
                        placeholder="notas do mestre (privadas — nunca vazam pros jogadores)"
                        value={n.notasMestre ?? ''}
                        onChange={(e) => atualizarNpc(n.id, { notasMestre: e.target.value })}
                        style={{ marginTop: '0.3rem', minHeight: '2.5em', borderColor: 'var(--ruido-dim)' }}
                      />

                      <textarea
                        placeholder="notas — comportamento, gatilho, o que ele quer"
                        value={n.notas}
                        onChange={(e) => atualizarNpc(n.id, { notas: e.target.value })}
                        style={{ marginTop: '0.3rem', minHeight: '2.5em' }}
                      />

                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.3rem' }}>
                        <span className="vazio" style={{ fontSize: 11 }}>categoria</span>
                        <input
                          type="text"
                          placeholder="ex: Sentinela, Anomalia..."
                          value={n.categoria ?? ''}
                          onChange={(e) => atualizarNpc(n.id, { categoria: e.target.value })}
                          style={{ flex: 1, fontSize: 11 }}
                        />
                      </div>

                      <div style={{ marginTop: '0.4rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                          <span className="vazio" style={{ fontSize: 11 }}>ações</span>
                          <button className="icone-botao" onClick={() => abrirNovaAcao(n.id)} style={{ fontSize: 10 }}>
                            + ação
                          </button>
                        </div>
                        {(n.acoes ?? []).length === 0 && !acaoEditandoId[n.id] ? (
                          <p className="vazio" style={{ fontSize: 10, margin: 0 }}>nenhuma ação definida.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {(n.acoes ?? []).map((a) => {
                              if (acaoEditandoId[n.id] === a.id) {
                                return (
                                  <InlineAcaoEditor
                                    key={a.id}
                                    acao={a}
                                    onSalvar={(patch) => salvarAcao(n.id, a.id, patch)}
                                    onCancelar={() => fecharEditorAcao(n.id)}
                                  />
                                );
                              }
                              return (
                                <div
                                  key={a.id}
                                  className="combate-chip combate-chip--ativa"
                                  onClick={() => setAcaoEditandoId((prev) => ({ ...prev, [n.id]: a.id }))}
                                  title="editar ação"
                                  style={{ fontSize: 10, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', alignSelf: 'flex-start' }}
                                >
                                  🗡 {a.nome}{a.bonus > 0 ? ` +${a.bonus}` : a.bonus < 0 ? ` ${a.bonus}` : ''}{a.dano ? ` · ${a.dano}` : ''}
                                  <span
                                    className="icone-botao"
                                    role="button"
                                    tabIndex={0}
                                    onClick={(ev) => { ev.stopPropagation(); removerAcao(n.id, a.id); }}
                                    style={{ color: 'var(--ruido)', fontSize: 10, padding: 0, marginLeft: '0.15rem', lineHeight: 1 }}
                                  >
                                    ×
                                  </span>
                                </div>
                              );
                            })}
                            {acaoEditandoId[n.id] === '__new__' && (
                              <InlineAcaoEditor
                                key="nova"
                                acao={criarNpcAcao()}
                                onSalvar={(patch) => salvarNovaAcao(n.id, patch)}
                                onCancelar={() => fecharEditorAcao(n.id)}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', marginBottom: '0.3rem' }}>
                        <span className="mono" style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
                          {n.nome || 'sem nome'}
                        </span>
                        {n.visivel && (
                          <span className="badge" style={{ borderColor: 'var(--rede)', color: 'var(--rede)', fontSize: 9, padding: '0.1em 0.4em' }}>
                            visível
                          </span>
                        )}
                        <span
                          className="icone-botao"
                          role="button"
                          tabIndex={0}
                          onClick={() => atualizarNpc(n.id, { visivel: !n.visivel })}
                          title={n.visivel ? 'ocultar dos jogadores' : 'revelar aos jogadores'}
                          style={{ color: n.visivel ? 'var(--rede)' : 'var(--ink-faint)', fontSize: 13 }}
                        >
                          {n.visivel ? '👁' : '👁‍🗨'}
                        </span>
                        <span
                          className="icone-botao"
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleEditando(n.id)}
                          title="editar"
                          style={{ fontSize: 13 }}
                        >
                          ⚙
                        </span>
                        <span
                          className="icone-botao"
                          role="button"
                          tabIndex={0}
                          onClick={() => duplicarNpc(n.id)}
                          title="duplicar"
                          style={{ fontSize: 12 }}
                        >
                          ⊞
                        </span>
                        <span
                          className="icone-botao"
                          role="button"
                          tabIndex={0}
                          onClick={() => remover(n.id, n.nome)}
                          style={{ color: 'var(--ruido)' }}
                        >
                          ×
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                        <div style={{ width: 80, height: 10, background: 'var(--void)', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
                          <div
                            style={{
                              width: `${Math.max(0, (n.pvAtual / Math.max(1, n.pvMaximo)) * 100)}%`,
                              height: '100%',
                              background: corPv(n.pvAtual, n.pvMaximo),
                              borderRadius: 2,
                            }}
                          />
                        </div>
                        <span className="mono" style={{ fontSize: 11, minWidth: 48, textAlign: 'right', flexShrink: 0 }}>
                          {n.pvAtual}/{n.pvMaximo}
                        </span>
                        <span className="mono" style={{ fontSize: 12, color: 'var(--real)', flexShrink: 0 }}>
                          🛡{n.defesa}
                        </span>
                      </div>

                      {(n.acoes ?? []).length > 0 && (
                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                          {(n.acoes ?? []).map((a) => (
                            <button
                              key={a.id}
                              className="combate-chip combate-chip--ativa"
                              onClick={() => usarAcao(n.nome || 'NPC', a)}
                              title={`+${a.bonus}${a.dano ? ` · dano ${a.dano}` : ''}`}
                              style={{ fontSize: 11, cursor: 'pointer' }}
                            >
                              🗡 {a.nome}
                            </button>
                          ))}
                        </div>
                      )}

                      {n.notasMestre && (
                        <p className="vazio" style={{ fontSize: 10, margin: '0.1rem 0', color: 'var(--ruido)', fontStyle: 'italic' }}>
                          {n.notasMestre ?? ''}
                        </p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="secao" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>iniciativa</h3>
        </div>

        <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          <button className="icone-botao" onClick={resetar} style={{ borderColor: 'var(--ruido-dim)', color: 'var(--ruido)' }}>
            resetar
          </button>
          {selecionadosIniciativa.length > 0 && (
            <button className="icone-botao acento" onClick={rolarSelecionados} disabled={nenhumSelecionado && disponiveis.length > 0}>
              rolar inic.
            </button>
          )}
          {modoCombate ? (
            <>
              <button className="icone-botao acento" onClick={avancarTurno}>próximo</button>
              <button className="icone-botao" onClick={encerrarModoCombate}>encerrar</button>
            </>
          ) : (
            <button className="icone-botao acento" onClick={iniciarModoCombate} disabled={iniciativa.length === 0}>
              iniciar
            </button>
          )}
        </div>

        <div
          className="alerta-banner"
          style={{
            marginBottom: '0.5rem',
            borderColor: modoCombate ? 'var(--rede)' : undefined,
            color: modoCombate ? 'var(--rede)' : undefined,
            display: iniciativa.length === 0 ? 'none' : undefined,
          }}
        >
          <span className="mono">
            {modoCombate ? `combate · rodada ${rodada} · vez de ${iniciativa[indiceAtualTurno]?.nome ?? '?'}` : 'fora de combate'}
          </span>
        </div>

        {iniciativa.length === 0 ? (
          <>
            <p className="vazio" style={{ marginBottom: '0.4rem' }}>
              {disponiveis.length === 0 ? 'nenhum combatente disponível.' : 'selecione os combatentes:'}
            </p>
            {disponiveis.length > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: 11, marginBottom: '0.4rem', color: 'var(--ink-dim)' }}>
                <input type="checkbox" checked={todosSelecionados} onChange={toggleTodos} />
                selecionar todos
              </label>
            )}
            {disponiveis.map((p) => {
              const marcado = selecionadosIniciativa.includes(p.id);
              return (
                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: 13, marginBottom: '0.25rem', opacity: marcado ? 1 : 0.5 }}>
                  <input type="checkbox" checked={marcado} onChange={() => toggleSelecionado(p.id)} />
                  <span className="mono">{p.nome}</span>
                  <span className="vazio" style={{ fontSize: 11 }}>({p.tipo === 'pc' ? 'PC' : 'NPC'})</span>
                </label>
              );
            })}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {iniciativa.map((e, i) => {
              const naVez = modoCombate && i === indiceAtualTurno;
              const exp = expandidos.has(e.id) || naVez;
              const pv = pvDoCombatente(e.participanteId, e.tipo);
              const defesa = defesaDoCombatente(e.participanteId, e.tipo);
              const ativas = (condicoesCombate ?? {})[e.participanteId] ?? [];
              const pvPct = pv ? pv.atual / pv.maximo : 0;
              const sessaoSurto: EstadoSessaoParaSurto = { modoCombate, contadorCena, rodada };
              const fichaSurto = e.tipo === 'pc' ? fichas.find((f) => f.id === e.participanteId)?.surtoAtivo ?? null : null;
              const emSurto = personagemEstaEmSurto(fichaSurto, sessaoSurto);
              const sendoArrastado = dragIndex === i;
              const alvoDrop = dropIndex === i;
              const npcAcoes = e.tipo === 'npc' ? npcs.find((n) => n.id === e.participanteId)?.acoes ?? [] : [];
              return (
                <div
                  key={e.id}
                  draggable
                  onDragStart={() => { setDragIndex(i); setDropIndex(null); }}
                  onDragOver={(ev) => { ev.preventDefault(); setDropIndex(i); }}
                  onDragLeave={() => setDropIndex(null)}
                  onDrop={() => { if (dragIndex !== null && dragIndex !== i) { reordenarIniciativa(dragIndex, i); } setDragIndex(null); setDropIndex(null); }}
                  onDragEnd={() => { setDragIndex(null); setDropIndex(null); }}
                  style={{
                    borderBottom: '2px solid var(--concrete-2)', padding: '0.25rem 0',
                    opacity: sendoArrastado ? 0.3 : 1,
                    borderTop: alvoDrop ? '2px solid var(--rede)' : undefined,
                    transition: 'opacity 0.15s',
                    cursor: 'grab',
                  }}
                >
                  <div
                    onClick={() => toggleExpandido(e.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: 12,
                      padding: '0.15rem 0',
                    }}
                  >
                    <span
                      className="icone-botao"
                      role="button"
                      tabIndex={0}
                      onClick={(ev) => { ev.stopPropagation(); removerDaIniciativa(e.id); }}
                      title="remover"
                      style={{ color: 'var(--ruido)', padding: '0.1em 0.3em', fontSize: 10, lineHeight: 1, flexShrink: 0 }}
                    >
                      ×
                    </span>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--ink-faint)', minWidth: 14 }}>
                      {i + 1}
                    </span>
                    {naVez && <span className="mono" style={{ color: 'var(--rede)', fontSize: 11 }}>▶</span>}
                    <span
                      className="mono"
                      style={{
                        flex: 1, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        color: naVez ? 'var(--rede)' : undefined,
                      }}
                    >
                      {e.nome}
                    </span>
                    {emSurto && (
                      <span style={{ color: 'var(--ruido)', flexShrink: 0, display: 'inline-flex', alignItems: 'center' }} title="em surto">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                      </span>
                    )}
                    {pv && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                        <div style={{ width: 56, height: 8, background: 'var(--void)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.max(0, pvPct * 100)}%`, height: '100%', background: corPv(pv.atual, pv.maximo), borderRadius: 2, transition: 'width 0.2s' }} />
                        </div>
                        <span className="mono" style={{ fontSize: 10, minWidth: 36, textAlign: 'right' }}>
                          {pv.atual}/{pv.maximo}
                        </span>
                      </div>
                    )}
                    {defesa && (
                      <span className="mono" style={{ fontSize: 11, color: 'var(--real)', flexShrink: 0 }}>
                        🛡{defesa.valor}
                      </span>
                    )}
                  </div>
                  {exp && (
                    <div style={{ padding: '0.25rem 0 0.1rem 1.1rem' }}>
                      {emSurto && (
                        <span className="badge" style={{ borderColor: 'var(--ruido)', color: 'var(--ruido)', alignSelf: 'flex-start', marginBottom: '0.25rem', fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                          </svg>
                          em surto
                        </span>
                      )}
                      {npcAcoes.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                          {npcAcoes.map((a) => (
                            <button
                              key={a.id}
                              className="combate-chip combate-chip--ativa"
                              onClick={() => usarAcao(e.nome, a)}
                              title={`${a.bonus >= 0 ? '+' : ''}${a.bonus}${a.dano ? ` · dano ${a.dano}` : ''}`}
                              style={{ fontSize: 10, cursor: 'pointer' }}
                            >
                              🗡 {a.nome}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="combate-condicoes" style={{ marginBottom: '0.25rem' }}>
                        {CONDICOES_COMBATE.map((c) => {
                          const ligada = ativas.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              className={`combate-chip${ligada ? ' combate-chip--ativa' : ''}`}
                              title={c.efeito}
                              onClick={() => alternarCondicaoCombate(e.participanteId, c.id)}
                            >
                              {c.nome}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {pv && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span className="vazio" style={{ fontSize: 10 }}>PV</span>
                            <button className="icone-botao" onClick={() => pv.aplicar(-1)} style={{ fontSize: 10, padding: '0.1em 0.35em' }}>−</button>
                            <span className="mono" style={{ fontSize: 11, minWidth: 32, textAlign: 'center' }}>{pv.atual}</span>
                            <button className="icone-botao" onClick={() => pv.aplicar(1)} style={{ fontSize: 10, padding: '0.1em 0.35em' }}>+</button>
                          </div>
                        )}
                        {defesa && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span className="vazio" style={{ fontSize: 10, color: 'var(--real)' }}>🛡</span>
                            <button className="icone-botao" onClick={() => defesa.ajustar(-1)} style={{ fontSize: 10, padding: '0.1em 0.35em' }}>−</button>
                            <span className="mono" style={{ fontSize: 11, minWidth: 20, textAlign: 'center' }}>{defesa.valor}</span>
                            <button className="icone-botao" onClick={() => defesa.ajustar(1)} style={{ fontSize: 10, padding: '0.1em 0.35em' }}>+</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {!modoCombate && (
              <div style={{ borderTop: '1px solid var(--concrete-2)', paddingTop: '0.3rem', marginTop: '0.15rem' }}>
                <button
                  className="icone-botao"
                  onClick={() => setAdicionarAberto(!adicionarAberto)}
                  style={{ fontSize: 11, width: '100%' }}
                >
                  {adicionarAberto ? '− recolher' : '+ adicionar combatente'}
                </button>
                {adicionarAberto && (
                  <div style={{ marginTop: '0.3rem' }}>
                    {disponiveis.length === 0 ? (
                      <p className="vazio" style={{ fontSize: 10, margin: 0 }}>nenhum disponível.</p>
                    ) : (
                      <>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: 10, marginBottom: '0.2rem', color: 'var(--ink-dim)' }}>
                          <input type="checkbox" checked={todosSelecionados} onChange={toggleTodos} />
                          selecionar todos
                        </label>
                        {disponiveis.map((p) => {
                          const marcado = selecionadosIniciativa.includes(p.id);
                          return (
                            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: 11, marginBottom: '0.15rem', opacity: marcado ? 1 : 0.5 }}>
                              <input type="checkbox" checked={marcado} onChange={() => toggleSelecionado(p.id)} />
                              <span className="mono">{p.nome}</span>
                            </label>
                          );
                        })}
                        {adicionarDisponiveis.length > 0 && (
                          <button className="icone-botao acento" onClick={rolarSelecionados} style={{ marginTop: '0.2rem', fontSize: 10 }}>
                            + adicionar e rolar
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
