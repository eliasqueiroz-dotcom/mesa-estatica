import { useState } from 'react';
import { calcularDefesa, calcularPvMaximo } from '../../rules/derivados';
import { CONDICOES_COMBATE } from '../../rules/data/condicoesCombate';
import { useStore } from '../../state/store';

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

export default function CombatOverlay() {
  const iniciativa = useStore((s) => s.iniciativa);
  const modoCombate = useStore((s) => s.sessaoPublica.modoCombate);
  const indiceAtualTurno = useStore((s) => s.sessaoPublica.indiceAtualTurno);
  const rodada = useStore((s) => s.sessaoPublica.rodada);
  const condicoesCombate = useStore((s) => s.sessaoPublica.condicoesCombate);
  const fichas = useStore((s) => s.fichas);
  const npcs = useStore((s) => s.npcs);
  const basePV = useStore((s) => s.config.basePV);
  const selecionadosIniciativa = useStore((s) => s.sessaoPrivada.selecionadosIniciativa);
  const atualizarSessaoPrivada = useStore((s) => s.atualizarSessaoPrivada);

  const rolarIniciativaTodos = useStore((s) => s.rolarIniciativaTodos);
  const rolarIniciativa = useStore((s) => s.rolarIniciativa);
  const limparIniciativa = useStore((s) => s.limparIniciativa);
  const removerDaIniciativa = useStore((s) => s.removerDaIniciativa);
  const reordenarIniciativa = useStore((s) => s.reordenarIniciativa);
  const iniciarModoCombate = useStore((s) => s.iniciarModoCombate);
  const avancarTurno = useStore((s) => s.avancarTurno);
  const encerrarModoCombate = useStore((s) => s.encerrarModoCombate);
  const ajustarPvAtual = useStore((s) => s.ajustarPvAtual);
  const atualizarNpc = useStore((s) => s.atualizarNpc);
  const atualizarFicha = useStore((s) => s.atualizarFicha);
  const alternarCondicaoCombate = useStore((s) => s.alternarCondicaoCombate);

  const [aberto, setAberto] = useState(false);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [adicionarAberto, setAdicionarAberto] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const participantesDisponiveis = [
    ...fichas.map((f) => ({ id: f.id, tipo: 'pc' as const, nome: f.nome || 'sem nome' })),
    ...npcs.map((n) => ({ id: n.id, tipo: 'npc' as const, nome: n.nome || 'sem nome' })),
  ];

  const jaNaIniciativa = new Set(iniciativa.map((e) => e.participanteId));
  const disponiveis = participantesDisponiveis.filter((p) => !jaNaIniciativa.has(p.id));
  const todosSelecionados = disponiveis.length > 0 && disponiveis.every((p) => selecionadosIniciativa.includes(p.id));
  const nenhumSelecionado = disponiveis.length > 0 && disponiveis.every((p) => !selecionadosIniciativa.includes(p.id));

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

  return (
    <div
      style={{
        position: 'absolute',
        left: '0.5rem',
        top: '0.5rem',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
      }}
    >
      {aberto && (
        <div
          className="secao"
          style={{ width: 380, maxHeight: '70vh', overflowY: 'auto', marginBottom: '0.6rem', boxShadow: '0 4px 24px rgba(0,0,0,0.5)', padding: '0.5rem 0.75rem' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <h3 className="label" style={{ margin: 0, fontSize: 12 }}>
              combate {modoCombate ? `· rodada ${rodada}` : ''}
            </h3>
            <button className="icone-botao" onClick={() => setAberto(false)} title="fechar">
              ×
            </button>
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
                <button className="icone-botao acento" onClick={avancarTurno}>
                  próximo
                </button>
                <button className="icone-botao" onClick={encerrarModoCombate}>
                  encerrar
                </button>
              </>
            ) : (
              <button className="icone-botao acento" onClick={iniciarModoCombate} disabled={iniciativa.length === 0}>
                iniciar
              </button>
            )}
          </div>

          {iniciativa.length === 0 ? (
            <>
              {disponiveis.length === 0 ? (
                <p className="vazio" style={{ fontSize: 11, margin: '0.25rem 0' }}>nenhum combatente disponível.</p>
              ) : (
                <>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: 11, marginBottom: '0.3rem', color: 'var(--ink-dim)' }}>
                    <input type="checkbox" checked={todosSelecionados} onChange={toggleTodos} />
                    selecionar todos
                  </label>
                  {disponiveis.map((p) => {
                    const marcado = selecionadosIniciativa.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: 12,
                          marginBottom: '0.2rem', opacity: marcado ? 1 : 0.5,
                        }}
                      >
                        <input type="checkbox" checked={marcado} onChange={() => toggleSelecionado(p.id)} />
                        <span className="mono">{p.nome}</span>
                        <span className="vazio" style={{ fontSize: 10 }}>({p.tipo === 'pc' ? 'PC' : 'NPC'})</span>
                      </label>
                    );
                  })}
                </>
              )}
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
                const sendoArrastado = dragIndex === i;
                const alvoDrop = dropIndex === i;
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
                              <span className="vazio" style={{ fontSize: 10 }}>🛡</span>
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
      )}
      <button
        onClick={() => setAberto(!aberto)}
        title="combate"
        style={
          modoCombate
            ? { borderRadius: '50%', width: 48, height: 48, padding: 0, borderColor: 'var(--rede-dim)', color: 'var(--rede)' }
            : { borderRadius: '50%', width: 48, height: 48, padding: 0 }
        }
      >
        {modoCombate ? `R${rodada}` : 'X1'}
      </button>
    </div>
  );
}
