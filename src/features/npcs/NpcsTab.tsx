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
  const removerDaIniciativa = useStore((s) => s.removerDaIniciativa);
  const limparIniciativa = useStore((s) => s.limparIniciativa);

  const modoCombate = useStore((s) => s.sessaoPublica.modoCombate);
  const indiceAtualTurno = useStore((s) => s.sessaoPublica.indiceAtualTurno);
  const rodada = useStore((s) => s.sessaoPublica.rodada);
  const iniciarModoCombate = useStore((s) => s.iniciarModoCombate);
  const avancarTurno = useStore((s) => s.avancarTurno);
  const encerrarModoCombate = useStore((s) => s.encerrarModoCombate);

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
            <button className="acento" onClick={rolarIniciativaTodos} disabled={fichas.length === 0 && npcs.length === 0}>
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
          <p className="vazio">sem ordem de combate. role a iniciativa quando o encontro começar.</p>
        ) : (
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
                    <span
                      className="icone-botao"
                      role="button"
                      tabIndex={0}
                      onClick={() => removerDaIniciativa(e.id)}
                      title="fora de combate"
                      style={{ color: 'var(--ruido)' }}
                    >
                      ×
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
