import { useEffect, useRef, useState } from 'react';
import Avatar from '../../components/Avatar';
import InputNumeroDraft from '../../components/InputNumeroDraft';
import { corPv, useIniciativa } from '../../hooks/useIniciativa';
import { comprimirImagemAvatar } from '../../lib/comprimirImagem';
import { uploadImagemStorage } from '../../multiplayer/uploadImagemStorage';
import { marcarRemocaoExplicita } from '../../multiplayer/remocaoExplicita';
import { ARMAS } from '../../rules/data/armas';
import { criarNpcAcao } from '../../state/factories';
import { useStore } from '../../state/store';
import type { NpcAcao } from '../../state/types';
import ArmasCombateNpc from '../combate/ArmasCombateNpc';
import IniciativaPanel from '../iniciativa/IniciativaPanel';
import './npcs.css';
import SeletorSilhueta from './SeletorSilhueta';

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
  const [comprimindoFotoIds, setComprimindoFotoIds] = useState<Set<string>>(new Set());

  const iniciativa = useIniciativa();
  const npcs = useStore((s) => s.npcs);
  const adicionarNpc = useStore((s) => s.adicionarNpc);
  const duplicarNpc = useStore((s) => s.duplicarNpc);
  const atualizarNpc = useStore((s) => s.atualizarNpc);
  const removerNpc = useStore((s) => s.removerNpc);

  const novaAcaoRef = useRef(criarNpcAcao());
  const categorias = [...new Set(npcs.map((n) => n.categoria ?? '').filter(Boolean))];
  const npcsFiltrados = filtroCategoria ? npcs.filter((n) => (n.categoria ?? '') === filtroCategoria) : npcs;

  const remover = (id: string, nome: string) => {
    const ok = window.confirm(`tirar "${nome || 'sem nome'}" do tabuleiro? não volta.`);
    if (ok) {
      marcarRemocaoExplicita(id);
      removerNpc(id);
    }
  };

  const novoNpc = () => {
    const id = adicionarNpc();
    setEditandoNpcs((prev) => new Set(prev).add(id));
  };

  const handleFoto = (id: string) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    setComprimindoFotoIds((prev) => new Set(prev).add(id));
    try {
      const { dataUrl, blob } = await comprimirImagemAvatar(arquivo);
      atualizarNpc(id, { foto: dataUrl });
      const { url } = await uploadImagemStorage(`npcs/${id}`, blob);
      if (url) atualizarNpc(id, { foto: url });
    } catch {
      window.alert('sinal corrompido — não foi possível ler essa imagem.');
    } finally {
      setComprimindoFotoIds((prev) => {
        const novo = new Set(prev);
        novo.delete(id);
        return novo;
      });
    }
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
    novaAcaoRef.current = criarNpcAcao();
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
    atualizarNpc(npcId, { acoes: [...(npc.acoes ?? []), { ...acao, ...patch }] });
    fecharEditorAcao(npcId);
  };

  const salvarAcao = (npcId: string, acaoId: string, patch: Partial<NpcAcao>) => {
    const npc = npcs.find((n) => n.id === npcId);
    if (!npc) return;
    atualizarNpc(npcId, { acoes: (npc.acoes ?? []).map((a) => (a.id === acaoId ? { ...a, ...patch } : a)) });
    fecharEditorAcao(npcId);
  };

  const removerAcao = (npcId: string, acaoId: string) => {
    const npc = npcs.find((n) => n.id === npcId);
    if (!npc) return;
    atualizarNpc(npcId, { acoes: npc.acoes.filter((a) => a.id !== acaoId) });
  };

  const adicionarAcaoDoArsenal = (npcId: string, nomeArma: string) => {
    const def = ARMAS.find((a) => a.nome === nomeArma);
    const npc = npcs.find((n) => n.id === npcId);
    if (!def || !npc) return;
    const nova: NpcAcao = { id: crypto.randomUUID(), nome: def.nome, bonus: 0, dano: def.dano };
    atualizarNpc(npcId, { acoes: [...(npc.acoes ?? []), nova] });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1rem', alignItems: 'start' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem' }}>
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

                      <div className="npc-card__secao" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
                        <span className="label npc-card__secao-titulo">estatísticas</span>
                        <div className="npc-card__grid">
                          <div>
                            <label htmlFor={`npc-pv-${n.id}`}>PV atual</label>
                            <InputNumeroDraft id={`npc-pv-${n.id}`} value={n.pvAtual} onCommit={(valor) => atualizarNpc(n.id, { pvAtual: valor })} />
                          </div>
                          <div>
                            <label htmlFor={`npc-pvmax-${n.id}`}>PV máximo</label>
                            <InputNumeroDraft id={`npc-pvmax-${n.id}`} value={n.pvMaximo} onCommit={(valor) => atualizarNpc(n.id, { pvMaximo: valor })} />
                          </div>
                          <div>
                            <label htmlFor={`npc-defesa-${n.id}`}>Defesa</label>
                            <InputNumeroDraft id={`npc-defesa-${n.id}`} value={n.defesa} onCommit={(valor) => atualizarNpc(n.id, { defesa: valor })} />
                          </div>
                          <div>
                            <label htmlFor={`npc-agi-${n.id}`}>Agilidade</label>
                            <InputNumeroDraft id={`npc-agi-${n.id}`} value={n.agilidade} onCommit={(valor) => atualizarNpc(n.id, { agilidade: valor })} />
                          </div>
                        </div>
                      </div>

                      <div className="npc-card__secao">
                        <span className="label npc-card__secao-titulo">identidade</span>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          <span className="vazio" style={{ fontSize: 11, minWidth: 52 }}>categoria</span>
                          <input
                            type="text"
                            placeholder="ex: Sentinela, Anomalia..."
                            value={n.categoria ?? ''}
                            onChange={(e) => atualizarNpc(n.id, { categoria: e.target.value })}
                            style={{ flex: 1, fontSize: 11 }}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.4rem' }}>
                          <span className="vazio" style={{ fontSize: 11, minWidth: 52 }}>foto</span>
                          <Avatar nome={n.nome} cor={n.corVisual} foto={n.foto} silhueta={n.silhueta} bordaCor={n.corVisual} tamanho={36} />
                          <label className="mapa-upload-botao" style={{ fontSize: 10 }}>
                            {comprimindoFotoIds.has(n.id) ? 'comprimindo…' : n.foto ? 'trocar' : 'carregar'}
                            <input type="file" accept="image/*" hidden onChange={handleFoto(n.id)} disabled={comprimindoFotoIds.has(n.id)} />
                          </label>
                          {n.foto && (
                            <button className="icone-botao" onClick={() => atualizarNpc(n.id, { foto: null })} title="remover foto" style={{ fontSize: 10 }}>
                              ×
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.4rem' }}>
                          <span className="vazio" style={{ fontSize: 11, minWidth: 52 }}>silhueta</span>
                          <SeletorSilhueta valor={n.silhueta} onEscolher={(slug) => atualizarNpc(n.id, { silhueta: slug })} />
                        </div>
                      </div>

                      <div className="npc-card__secao">
                        <span className="label npc-card__secao-titulo">notas</span>
                        <textarea
                          placeholder="notas do mestre (privadas — nunca vazam pros jogadores)"
                          value={n.notasMestre ?? ''}
                          onChange={(e) => atualizarNpc(n.id, { notasMestre: e.target.value })}
                          style={{ minHeight: '2.5em', borderColor: 'var(--ruido-dim)' }}
                        />
                        <textarea
                          placeholder="notas — comportamento, gatilho, o que ele quer (jogadores veem, só leitura)"
                          value={n.notas}
                          onChange={(e) => atualizarNpc(n.id, { notas: e.target.value })}
                          style={{ marginTop: '0.3rem', minHeight: '2.5em' }}
                        />
                      </div>

                      <div className="npc-card__secao">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <span className="label npc-card__secao-titulo" style={{ marginBottom: 0 }}>armas</span>
                          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                            <select
                              value=""
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val) adicionarAcaoDoArsenal(n.id, val);
                              }}
                              style={{ fontSize: 10 }}
                            >
                              <option value="">+ do arsenal…</option>
                              {ARMAS.map((a) => (
                                <option key={a.nome} value={a.nome}>
                                  {a.nome}
                                </option>
                              ))}
                            </select>
                            <button className="icone-botao" onClick={() => abrirNovaAcao(n.id)} style={{ fontSize: 10 }}>
                              + arma
                            </button>
                          </div>
                        </div>
                        {(n.acoes ?? []).length === 0 && !acaoEditandoId[n.id] ? (
                          <p className="vazio" style={{ fontSize: 10, margin: 0 }}>nenhuma arma definida.</p>
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
                                acao={novaAcaoRef.current}
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
                        <Avatar nome={n.nome} cor={n.corVisual} foto={n.foto} silhueta={n.silhueta} tamanho={20} />
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

                      <ArmasCombateNpc npc={n} />

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

      <div className="secao" style={{ display: 'flex', flexDirection: 'column', padding: '0.75rem 0.9rem' }}>
        <IniciativaPanel
          hook={iniciativa}
          podeArrastar={true}
          header={
            <h3 style={{ margin: 0, marginBottom: '0.75rem' }}>iniciativa</h3>
          }
          banner={
            iniciativa.iniciativa.length > 0 ? (
              <div
                className="alerta-banner"
                style={{
                  marginBottom: '0.5rem',
                  borderColor: iniciativa.modoCombate ? 'var(--rede)' : undefined,
                  color: iniciativa.modoCombate ? 'var(--rede)' : undefined,
                }}
              >
                <span className="mono">
                  {iniciativa.modoCombate
                    ? `combate · rodada ${iniciativa.rodada} · vez de ${iniciativa.iniciativa.find((e) => e.id === iniciativa.turnoAtualId)?.nome ?? '?'}`
                    : 'fora de combate'}
                </span>
              </div>
            ) : undefined
          }
          estiloItem={{ padding: '0.35rem 0' }}
        />
      </div>
    </div>
  );
}
