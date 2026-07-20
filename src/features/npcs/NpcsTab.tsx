import { useStore } from '../../state/store';
import './npcs.css';

export default function NpcsTab() {
  const npcs = useStore((s) => s.npcs);
  const adicionarNpc = useStore((s) => s.adicionarNpc);
  const atualizarNpc = useStore((s) => s.atualizarNpc);
  const removerNpc = useStore((s) => s.removerNpc);

  const fichas = useStore((s) => s.fichas);
  const iniciativa = useStore((s) => s.iniciativa);
  const rolarIniciativaTodos = useStore((s) => s.rolarIniciativaTodos);
  const rolarIniciativa = useStore((s) => s.rolarIniciativa);
  const removerDaIniciativa = useStore((s) => s.removerDaIniciativa);
  const limparIniciativa = useStore((s) => s.limparIniciativa);

  const modoCombate = useStore((s) => s.sessaoPublica.modoCombate);
  const indiceAtualTurno = useStore((s) => s.sessaoPublica.indiceAtualTurno);
  const rodada = useStore((s) => s.sessaoPublica.rodada);
  const iniciarModoCombate = useStore((s) => s.iniciarModoCombate);
  const avancarTurno = useStore((s) => s.avancarTurno);
  const encerrarModoCombate = useStore((s) => s.encerrarModoCombate);

  const selecionadosIniciativa = useStore((s) => s.sessaoPrivada.selecionadosIniciativa);
  const atualizarSessaoPrivada = useStore((s) => s.atualizarSessaoPrivada);

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

  const adicionarDisponiveis = disponiveis.filter((p) => selecionadosIniciativa.includes(p.id));

  const remover = (id: string, nome: string) => {
    const ok = window.confirm(`tirar "${nome || 'sem nome'}" do tabuleiro? não volta.`);
    if (ok) removerNpc(id);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 1fr) minmax(280px, 380px)', gap: '1rem', alignItems: 'start' }}>
      <div className="secao">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>npcs</h3>
          <button className="acento" onClick={() => adicionarNpc()}>
            + novo npc
          </button>
        </div>

        {npcs.length === 0 ? (
          <p className="vazio">nenhum npc cadastrado ainda.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {npcs.map((n) => (
              <div key={n.id} className="npc-card">
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.4rem' }}>
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
                    style={{ width: 28, height: 28, padding: 0, border: 'none', cursor: 'pointer', background: 'none' }}
                  />
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
                    <input
                      id={`npc-pv-${n.id}`}
                      type="number"
                      value={n.pvAtual}
                      onChange={(e) => atualizarNpc(n.id, { pvAtual: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label htmlFor={`npc-pvmax-${n.id}`}>PV máximo</label>
                    <input
                      id={`npc-pvmax-${n.id}`}
                      type="number"
                      value={n.pvMaximo}
                      onChange={(e) => atualizarNpc(n.id, { pvMaximo: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label htmlFor={`npc-defesa-${n.id}`}>Defesa</label>
                    <input
                      id={`npc-defesa-${n.id}`}
                      type="number"
                      value={n.defesa}
                      onChange={(e) => atualizarNpc(n.id, { defesa: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label htmlFor={`npc-agi-${n.id}`}>Agilidade</label>
                    <input
                      id={`npc-agi-${n.id}`}
                      type="number"
                      value={n.agilidade}
                      onChange={(e) => atualizarNpc(n.id, { agilidade: Number(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <textarea
                  placeholder="notas — comportamento, gatilho, o que ele quer"
                  value={n.notas}
                  onChange={(e) => atualizarNpc(n.id, { notas: e.target.value })}
                  style={{ marginTop: '0.4rem', minHeight: '3em' }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="secao">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0 }}>iniciativa</h3>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button className="acento" onClick={rolarSelecionados} disabled={nenhumSelecionado && disponiveis.length > 0}>
                rolar iniciativa
              </button>
              {iniciativa.length > 0 && (
                <button className="perigo" onClick={limparIniciativa}>
                  limpar
                </button>
              )}
            </div>
          </div>

          {iniciativa.length > 0 && (
            <div
              className="alerta-banner"
              style={{
                marginBottom: '0.75rem',
                borderColor: modoCombate ? 'var(--rede)' : undefined,
                color: modoCombate ? 'var(--rede)' : undefined,
              }}
            >
              <span className="mono">
                {modoCombate ? `combate — rodada ${rodada} · vez de ${iniciativa[indiceAtualTurno]?.nome ?? '?'}` : 'fora de combate'}
              </span>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {modoCombate ? (
                  <>
                    <button className="icone-botao acento" onClick={avancarTurno}>
                      próximo turno
                    </button>
                    <button className="icone-botao" onClick={encerrarModoCombate}>
                      encerrar combate
                    </button>
                  </>
                ) : (
                  <button className="icone-botao acento" onClick={iniciarModoCombate}>
                    iniciar combate
                  </button>
                )}
              </div>
            </div>
          )}

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
            <>
              <table className="armas-tabela iniciativa-tabela">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>nome</th>
                    <th>tipo</th>
                    <th>total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {iniciativa.map((e, i) => (
                    <tr
                      key={e.id}
                      style={
                        modoCombate && i === indiceAtualTurno
                          ? { background: 'color-mix(in srgb, var(--rede) 15%, transparent)' }
                          : undefined
                      }
                    >
                      <td className="mono">{modoCombate && i === indiceAtualTurno ? '▶' : i + 1}</td>
                      <td>{e.nome}</td>
                      <td className="mono">{e.tipo === 'pc' ? 'pc' : 'npc'}</td>
                      <td className="mono">{e.valor}</td>
                      <td>
                        {!modoCombate && (
                          <span
                            className="icone-botao"
                            role="button"
                            tabIndex={0}
                            onClick={() => removerDaIniciativa(e.id)}
                            title="remover"
                            style={{ color: 'var(--ruido)' }}
                          >
                            ×
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!modoCombate && disponiveis.length > 0 && (
                <div style={{ borderTop: '1px solid var(--concrete-2)', paddingTop: '0.4rem', marginTop: '0.5rem' }}>
                  <p className="vazio" style={{ fontSize: 11, marginBottom: '0.3rem' }}>adicionar mais:</p>
                  {disponiveis.map((p) => {
                    const marcado = selecionadosIniciativa.includes(p.id);
                    return (
                      <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: 12, marginBottom: '0.25rem', opacity: marcado ? 1 : 0.5 }}>
                        <input type="checkbox" checked={marcado} onChange={() => toggleSelecionado(p.id)} />
                        <span className="mono">{p.nome}</span>
                      </label>
                    );
                  })}
                  {adicionarDisponiveis.length > 0 && (
                    <button className="icone-botao acento" onClick={rolarSelecionados} style={{ marginTop: '0.3rem', fontSize: 11 }}>
                      + adicionar
                    </button>
                  )}
                </div>
              )}
            </>
          )}
      </div>
    </div>
  );
}
