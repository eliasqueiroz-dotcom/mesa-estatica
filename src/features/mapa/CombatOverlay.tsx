import { useState } from 'react';
import { calcularPvMaximo } from '../../rules/derivados';
import { CONDICOES_COMBATE } from '../../rules/data/condicoesCombate';
import { useStore } from '../../state/store';

interface PvCombatente {
  atual: number;
  maximo: number;
  aplicar: (delta: number) => void;
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
  const iniciarModoCombate = useStore((s) => s.iniciarModoCombate);
  const avancarTurno = useStore((s) => s.avancarTurno);
  const encerrarModoCombate = useStore((s) => s.encerrarModoCombate);
  const ajustarPvAtual = useStore((s) => s.ajustarPvAtual);
  const atualizarNpc = useStore((s) => s.atualizarNpc);
  const alternarCondicaoCombate = useStore((s) => s.alternarCondicaoCombate);

  const [aberto, setAberto] = useState(false);

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
    if (modoCombate) encerrarModoCombate();
    if (iniciativa.length > 0) limparIniciativa();
  };

  const adicionarDisponiveis = disponiveis.filter((p) => selecionadosIniciativa.includes(p.id));

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
          style={{ width: 320, maxHeight: '70vh', overflowY: 'auto', marginBottom: '0.6rem', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h3 className="label" style={{ margin: 0 }}>
              combate
            </h3>
            <button className="icone-botao" onClick={() => setAberto(false)} title="fechar">
              ×
            </button>
          </div>

          <div
            className="alerta-banner"
            style={{
              marginBottom: '0.6rem',
              borderColor: modoCombate ? 'var(--rede)' : undefined,
              color: modoCombate ? 'var(--rede)' : undefined,
            }}
          >
            <span className="mono" style={{ fontSize: 12 }}>
              {modoCombate
                ? `rodada ${rodada} · vez de ${iniciativa[indiceAtualTurno]?.nome ?? '?'}`
                : 'fora de combate'}
            </span>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
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
                <>
                  <button
                    className="icone-botao"
                    onClick={rolarSelecionados}
                    disabled={nenhumSelecionado && disponiveis.length > 0}
                  >
                    rolar inic.
                  </button>
                  <button className="icone-botao acento" onClick={iniciarModoCombate} disabled={iniciativa.length === 0}>
                    iniciar
                  </button>
                  {(iniciativa.length > 0 || selecionadosIniciativa.length > 0) && (
                    <button className="icone-botao" onClick={resetar} title="limpar tudo" style={{ borderColor: 'var(--ruido-dim)', color: 'var(--ruido)' }}>
                      resetar
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {iniciativa.length === 0 ? (
            <>
              {disponiveis.length === 0 ? (
                <p className="vazio" style={{ fontSize: 12 }}>nenhum combatente disponível.</p>
              ) : (
                <>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: 11, marginBottom: '0.4rem', color: 'var(--ink-dim)' }}>
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
                          marginBottom: '0.25rem', opacity: marcado ? 1 : 0.5,
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {iniciativa.map((e, i) => {
                const naVez = modoCombate && i === indiceAtualTurno;
                const pv = pvDoCombatente(e.participanteId, e.tipo);
                const ativas = (condicoesCombate ?? {})[e.participanteId] ?? [];
                return (
                  <div
                    key={e.id}
                    className="combate-linha"
                    style={naVez ? { borderColor: 'var(--rede)' } : undefined}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                      <span style={{ fontSize: 13, color: naVez ? 'var(--rede)' : undefined }}>
                        <span className="mono">{naVez ? '▶' : i + 1}</span> {e.nome}
                      </span>
                      <span
                        className="icone-botao"
                        role="button"
                        tabIndex={0}
                        onClick={() => removerDaIniciativa(e.id)}
                        title="remover"
                        style={{ color: 'var(--ruido)', fontSize: 10, padding: '0.15em 0.4em', lineHeight: 1 }}
                      >
                        ×
                      </span>
                      {pv && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <button className="icone-botao" onClick={() => pv.aplicar(-1)} title="dano">−</button>
                          <span className="mono" style={{ fontSize: 12, minWidth: 44, textAlign: 'center' }}>{pv.atual}/{pv.maximo}</span>
                          <button className="icone-botao" onClick={() => pv.aplicar(1)} title="cura">+</button>
                        </div>
                      )}
                    </div>
                    <div className="combate-condicoes">
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
                  </div>
                );
              })}
              {!modoCombate && disponiveis.length > 0 && (
                <div style={{ borderTop: '1px solid var(--concrete-2)', paddingTop: '0.35rem' }}>
                  <p className="vazio" style={{ fontSize: 10, marginBottom: '0.25rem' }}>adicionar mais:</p>
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
                    <button className="icone-botao acento" onClick={rolarSelecionados} style={{ marginTop: '0.25rem', fontSize: 10 }}>+ adicionar</button>
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
