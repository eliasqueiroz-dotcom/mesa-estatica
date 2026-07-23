import type { ReactNode } from 'react';
import { CONDICOES_COMBATE } from '../../rules/data/condicoesCombate';
import { TABELA_SURTO } from '../../rules/data/surto';
import { personagemEstaEmSurto, type EstadoSessaoParaSurto } from '../../rules/surto';
import { corPv, type useIniciativa } from '../../hooks/useIniciativa';

interface IniciativaPanelProps {
  hook: ReturnType<typeof useIniciativa>;
  header: ReactNode;
  banner?: ReactNode;
  estiloItem?: React.CSSProperties;
  podeArrastar?: boolean;
}

export default function IniciativaPanel({ hook, header, banner, estiloItem, podeArrastar = true }: IniciativaPanelProps) {
  const {
    iniciativa, modoCombate, indiceAtualTurno, rodada, contadorCena,
    condicoesCombate, fichas, npcs,
    selecionadosIniciativa,
    removerDaIniciativa, reordenarIniciativa,
    iniciarModoCombate, avancarTurno, encerrarModoCombate,
    alternarCondicaoCombate,
    disponiveis, todosSelecionados, nenhumSelecionado, adicionarDisponiveis,
    expandidos, adicionarAberto, dragIndex, dropIndex,
    setDragIndex, setDropIndex, setAdicionarAberto,
    toggleSelecionado, toggleTodos, rolarSelecionados, resetar, toggleExpandido,
    pvDoCombatente, defesaDoCombatente, usarAcaoNpc,
  } = hook;

  return (
    <>
      {header}

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

      {banner}

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
            const sessaoSurto: EstadoSessaoParaSurto = { modoCombate, contadorCena, rodada };
            const fichaSurtos = e.tipo === 'pc' ? fichas.find((f) => f.id === e.participanteId)?.surtosAtivos ?? [] : [];
            const emSurto = personagemEstaEmSurto(fichaSurtos, sessaoSurto);
            const surtosVisiveis = fichaSurtos.filter((s) => {
              if (modoCombate) return s.expiraEm >= rodada;
              return s.expiraEm === contadorCena;
            });
            const sendoArrastado = dragIndex === i;
            const alvoDrop = dropIndex === i;
            const npcAcoes = e.tipo === 'npc' ? npcs.find((n) => n.id === e.participanteId)?.acoes ?? [] : [];
            return (
              <div
                key={e.id}
                draggable={podeArrastar}
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
                  ...estiloItem,
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
                      flex: 1, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
                      color: naVez ? 'var(--rede)' : undefined,
                    }}
                    title={e.nome}
                  >
                    {e.nome}
                  </span>
                  {emSurto && (
                    <span style={{ color: 'var(--ruido)', flexShrink: 0, display: 'inline-flex', alignItems: 'center' }} title={surtosVisiveis.filter((s) => s.escolha).map((s) => s.escolha).join(', ') || 'surto ativo'}>
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
                    {surtosVisiveis.filter((s) => s.escolha).map((s) => (
                      <span
                        key={s.id}
                        className="badge"
                        style={{ borderColor: 'var(--ruido)', color: 'var(--ruido)', alignSelf: 'flex-start', marginBottom: '0.25rem', fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                        title={TABELA_SURTO.find((e) => e.nome === s.escolha)?.descricao ?? ''}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                        {s.escolha}
                      </span>
                    ))}
                    {e.tipo === 'pc' && (() => {
                      const ficha = fichas.find((f) => f.id === e.participanteId);
                      if (!ficha || ficha.armas.length === 0) return null;
                      return (
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                          {ficha.armas.map((a) => (
                            <span
                              key={a.id}
                              className="badge"
                              style={{ alignSelf: 'flex-start', fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                              title={`${a.nome || 'arma'} · bonus: ${a.bonusAtaque} · dano: ${a.dano} · alcance: ${a.alcance}${a.nota ? ` · ${a.nota}` : ''}`}
                            >
                              🗡 {a.nome || 'arma'}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                    {npcAcoes.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                        {npcAcoes.map((a) => (
                          <button
                            key={a.id}
                            className="combate-chip combate-chip--ativa"
                            onClick={() => usarAcaoNpc(e.participanteId, e.nome, a)}
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
    </>
  );
}
