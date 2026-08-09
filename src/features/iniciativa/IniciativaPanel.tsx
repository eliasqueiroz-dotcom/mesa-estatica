import { useState, type ReactNode } from 'react';
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
  /** `CombatOverlay.tsx` já tem um "▶ próximo" fixo e maior no próprio header (C2 — sempre à
   *  mão, não some ao rolar a lista) — sem isso, o botão "próximo" daqui embaixo duplicava o
   *  mesmo comando. `NpcsTab.tsx` (header simples, sem essa duplicata) continua mostrando. */
  ocultarBotaoProximo?: boolean;
}

export default function IniciativaPanel({ hook, header, banner, estiloItem, podeArrastar = true, ocultarBotaoProximo = false }: IniciativaPanelProps) {
  const {
    iniciativa, modoCombate, indiceAtualTurno, rodada, contadorCena,
    condicoesCombate, condicaoDuracao, fichas, npcs,
    selecionadosIniciativa,
    removerDaIniciativa, reordenarIniciativa, rerolarIniciativaDe,
    iniciarModoCombate, avancarTurno, encerrarModoCombate,
    alternarCondicaoCombate,
    disponiveis, todosSelecionados, nenhumSelecionado, adicionarDisponiveis,
    expandidos, adicionarAberto, dragIndex, dropIndex,
    setDragIndex, setDropIndex, setAdicionarAberto,
    toggleSelecionado, toggleTodos, rolarSelecionados, resetar, toggleExpandido,
    pvDoCombatente, defesaDoCombatente, usarAcaoNpc,
    selecionadosAplicar, toggleSelecionadoAplicar, limparSelecaoAplicar,
    aplicarDanoEmMassa, aplicarCondicaoEmMassa,
    socorristaPorAlvo, definirSocorrista, tentarEstabilizar,
    agruparNpcs, setAgruparNpcs,
  } = hook;

  const [danoEmMassa, setDanoEmMassa] = useState('');
  const [condicaoEmMassa, setCondicaoEmMassa] = useState('');
  const [mostrarGlossario, setMostrarGlossario] = useState(false);

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
            {!ocultarBotaoProximo && (
              <button className="icone-botao acento" onClick={avancarTurno}>
                próximo
              </button>
            )}
            <button className="icone-botao" onClick={encerrarModoCombate}>
              encerrar
            </button>
          </>
        ) : (
          <button className="icone-botao acento" onClick={iniciarModoCombate} disabled={iniciativa.length === 0}>
            iniciar
          </button>
        )}
        <button className="icone-botao" onClick={() => setMostrarGlossario((v) => !v)}>
          glossário {mostrarGlossario ? '▲' : '▼'}
        </button>
      </div>

      {mostrarGlossario && (
        <div className="secao" style={{ marginBottom: '0.5rem', background: 'var(--concrete-0)' }}>
          {CONDICOES_COMBATE.map((c) => (
            <p key={c.id} className="vazio" style={{ margin: '0.2rem 0', fontSize: 11 }}>
              <strong style={{ color: 'var(--ink)' }}>{c.nome}</strong> — {c.efeito}
            </p>
          ))}
        </div>
      )}

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
              <label
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: 11, marginBottom: '0.3rem', color: 'var(--ink-dim)' }}
                title="1 d20 + a maior Agilidade entre os NPCs selecionados — todos com o mesmo valor de iniciativa"
              >
                <input type="checkbox" checked={agruparNpcs} onChange={(e) => setAgruparNpcs(e.target.checked)} />
                agrupar NPCs selecionados
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
            const duracoes = (condicaoDuracao ?? {})[e.participanteId] ?? {};
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
                data-ativo={naVez}
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
                  <input
                    type="checkbox"
                    checked={selecionadosAplicar.has(e.participanteId)}
                    onChange={() => toggleSelecionadoAplicar(e.participanteId)}
                    onClick={(ev) => ev.stopPropagation()}
                    title="selecionar pra aplicar dano/condição em área"
                    style={{ flexShrink: 0 }}
                  />
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
                  <span
                    className="icone-botao"
                    role="button"
                    tabIndex={0}
                    onClick={(ev) => { ev.stopPropagation(); rerolarIniciativaDe(e.participanteId); }}
                    title="rerrolar iniciativa (d20+Agilidade)"
                    style={{ padding: '0.1em 0.3em', fontSize: 10, lineHeight: 1, flexShrink: 0 }}
                  >
                    🎲
                  </span>
                  {iniciativa.length > 1 && i < iniciativa.length - 1 && (
                    <span
                      className="icone-botao"
                      role="button"
                      tabIndex={0}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        reordenarIniciativa(i, iniciativa.length - 1);
                        alternarCondicaoCombate(e.participanteId, 'aguardando');
                      }}
                      title="adiar — vai pro fim da ordem desta rodada"
                      style={{ padding: '0.1em 0.3em', fontSize: 10, lineHeight: 1, flexShrink: 0 }}
                    >
                      ⏭
                    </span>
                  )}
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
                  {pv && pv.atual <= 0 && (
                    <span
                      className="badge"
                      title={
                        ativas.includes('estavel')
                          ? 'estabilizado (Medicina DT 15) — acorda com 1 PV no fim da cena'
                          : '0 PV — caído, não morto. Sem socorro, morre em minutos (regras.md).'
                      }
                      style={{ borderColor: 'var(--ruido)', color: 'var(--ruido)', fontSize: 9, flexShrink: 0, padding: '0.1em 0.35em' }}
                    >
                      {ativas.includes('estavel') ? 'estável' : 'fora de combate'}
                    </span>
                  )}
                  {pv && pv.atual > 0 && pvPct <= 0.25 && (
                    <span
                      className="badge"
                      title="PV em 25% ou menos do máximo"
                      style={{ borderColor: 'var(--ruido)', color: 'var(--ruido)', fontSize: 9, flexShrink: 0, padding: '0.1em 0.35em' }}
                    >
                      crítico
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
                        const rodadasRestantes = duracoes[c.id];
                        return (
                          <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
                            <button
                              className={`combate-chip${ligada ? ' combate-chip--ativa' : ''}`}
                              title={c.efeito}
                              onClick={() => alternarCondicaoCombate(e.participanteId, c.id)}
                            >
                              {c.nome}
                              {rodadasRestantes !== undefined && ` (${rodadasRestantes})`}
                            </button>

                          </span>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {pv && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', flexWrap: 'wrap' }}>
                          <span className="vazio" style={{ fontSize: 10 }}>PV</span>
                          <button className="icone-botao" onClick={() => pv.aplicar(-10)} title="−10 PV" style={{ fontSize: 10, padding: '0.1em 0.35em' }}>−10</button>
                          <button className="icone-botao" onClick={() => pv.aplicar(-5)} title="−5 PV" style={{ fontSize: 10, padding: '0.1em 0.35em' }}>−5</button>
                          <button className="icone-botao" onClick={() => pv.aplicar(-1)} title="−1 PV" style={{ fontSize: 10, padding: '0.1em 0.35em' }}>−1</button>
                          <span className="mono" style={{ fontSize: 11, minWidth: 32, textAlign: 'center' }}>{pv.atual}</span>
                          <button className="icone-botao" onClick={() => pv.aplicar(1)} title="+1 (ajuste — não é cura, regras.md)" style={{ fontSize: 10, padding: '0.1em 0.35em' }}>+1</button>
                          <button className="icone-botao" onClick={() => pv.aplicar(5)} title="+5 (ajuste — não é cura, regras.md)" style={{ fontSize: 10, padding: '0.1em 0.35em' }}>+5</button>
                          <input
                            type="number"
                            placeholder="dano"
                            title="dano livre — Enter aplica"
                            style={{ width: 44, fontSize: 10, padding: '0.1em 0.25em' }}
                            onKeyDown={(ev) => {
                              if (ev.key !== 'Enter') return;
                              const alvo = ev.target as HTMLInputElement;
                              const valor = Number(alvo.value);
                              if (valor) pv.aplicar(-Math.abs(valor));
                              alvo.value = '';
                            }}
                          />
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
                    {pv && pv.atual <= 0 && !ativas.includes('estavel') && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                        <span className="vazio" style={{ fontSize: 10 }}>socorro:</span>
                        <select
                          value={socorristaPorAlvo[e.participanteId] ?? ''}
                          onChange={(ev) => definirSocorrista(e.participanteId, ev.target.value)}
                          style={{ fontSize: 10 }}
                        >
                          <option value="">quem tenta?</option>
                          {fichas
                            .filter((f) => f.id !== e.participanteId && (pvDoCombatente(f.id, 'pc')?.atual ?? 1) > 0)
                            .map((f) => (
                              <option key={f.id} value={f.id}>{f.nome || 'sem nome'}</option>
                            ))}
                        </select>
                        <button
                          className="icone-botao"
                          disabled={!socorristaPorAlvo[e.participanteId]}
                          onClick={() => tentarEstabilizar(e.participanteId)}
                          title="Medicina (Intelecto) DT 15 — estabiliza a 0 PV (regras.md)"
                          style={{ fontSize: 10 }}
                        >
                          estabilizar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {selecionadosAplicar.size > 0 && (
            <div
              style={{
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem',
                borderTop: '1px solid var(--rede-dim)', padding: '0.4rem 0', marginTop: '0.15rem',
              }}
            >
              <span className="mono" style={{ fontSize: 11, color: 'var(--rede)' }}>
                aplicar a {selecionadosAplicar.size}:
              </span>
              <input
                type="number"
                placeholder="dano"
                value={danoEmMassa}
                onChange={(ev) => setDanoEmMassa(ev.target.value)}
                style={{ width: 52, fontSize: 11, padding: '0.1em 0.3em' }}
              />
              <button
                className="icone-botao"
                title="aplica como dano (negativo) nos selecionados"
                onClick={() => {
                  const valor = Number(danoEmMassa);
                  if (valor) aplicarDanoEmMassa(-Math.abs(valor));
                  setDanoEmMassa('');
                }}
                style={{ fontSize: 10 }}
              >
                dano
              </button>
              <button
                className="icone-botao"
                title="ajuste — não é cura (regras.md: não existe cura em combate)"
                onClick={() => {
                  const valor = Number(danoEmMassa);
                  if (valor) aplicarDanoEmMassa(Math.abs(valor));
                  setDanoEmMassa('');
                }}
                style={{ fontSize: 10 }}
              >
                ajuste
              </button>
              <select
                value={condicaoEmMassa}
                onChange={(ev) => setCondicaoEmMassa(ev.target.value)}
                style={{ fontSize: 10 }}
              >
                <option value="">condição…</option>
                {CONDICOES_COMBATE.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
              <button
                className="icone-botao"
                disabled={!condicaoEmMassa}
                onClick={() => { if (condicaoEmMassa) aplicarCondicaoEmMassa(condicaoEmMassa); }}
                style={{ fontSize: 10 }}
              >
                aplicar
              </button>
              <button
                className="icone-botao"
                onClick={limparSelecaoAplicar}
                style={{ fontSize: 10, marginLeft: 'auto', color: 'var(--ink-dim)' }}
              >
                limpar seleção
              </button>
            </div>
          )}
          {/* também disponível COM o combate em andamento: o retardatário entra na posição do
              valor rolado e a vez continua de quem estava (store: `comIniciativaInserida`).
              Ficava escondido durante o combate porque a inserção antiga jogava todo mundo
              pro fim da lista. */}
          {(
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
                      <label
                        style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: 10, marginBottom: '0.2rem', color: 'var(--ink-dim)' }}
                        title="1 d20 + a maior Agilidade entre os NPCs selecionados — todos com o mesmo valor de iniciativa"
                      >
                        <input type="checkbox" checked={agruparNpcs} onChange={(e) => setAgruparNpcs(e.target.checked)} />
                        agrupar NPCs selecionados
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
