import { useState } from 'react';
import { rolarDadoComForcados } from '../../dice/registroForcados';
import { resolverTabela, validarCoberturaTabela } from '../../rules/data/tabelasSeed';
import { useStore } from '../../state/store';

/**
 * Rolador de Tabelas Aleatórias (ROADMAP F6) — ferramenta GM-only de improvisação: rola um
 * dado de `lados` faces, consulta a entradas da tabela selecionada por range (min–max) e
 * mostra o resultado inline + registra no log como `"anotação"` privada. Não disputa a bandeja
 * 3D dos outros roladores — rola síncrono via `rolarDadoComForcados` (honesto por padrão,
 * respeita a fila de forçados do mestre se houver).
 *
 * Tem dois modos (toggle no header da seção):
 *   · `rolar`  — dropdown de tabela + botão + resultado. Default.
 *   · `editar` — edita nome/lados da tabela, lista de entradas com inputs min/max/texto,
 *     add/remove entrada, add/remove tabela. Validação visual de gaps/overlaps via
 *     `validarCoberturaTabela` (aviso, não bloqueia — o GM pode ter gaps intencionais).
 *
 * Sem state efêmero compartilhado — tudo lê/escreve direto em `useStore.tabelas` (persistente).
 */
export default function RoladorTabelas() {
  const tabelas = useStore((s) => s.tabelas);
  const adicionarTabela = useStore((s) => s.adicionarTabela);
  const atualizarTabela = useStore((s) => s.atualizarTabela);
  const removerTabela = useStore((s) => s.removerTabela);
  const adicionarEntradaTabela = useStore((s) => s.adicionarEntradaTabela);
  const atualizarEntradaTabela = useStore((s) => s.atualizarEntradaTabela);
  const removerEntradaTabela = useStore((s) => s.removerEntradaTabela);
  const registrarLog = useStore((s) => s.registrarLog);

  const [modo, setModo] = useState<'rolar' | 'editar'>('rolar');
  const [tabelaId, setTabelaId] = useState('');
  const [resultado, setResultado] = useState<{ rolagem: number; texto: string; tabelaNome: string } | null>(null);

  const tabela = tabelas.find((t) => t.id === tabelaId) ?? tabelas[0] ?? null;

  const rolar = () => {
    if (!tabela) return;
    const valor = rolarDadoComForcados(tabela.lados, null, 'qualquer');
    const entrada = resolverTabela(tabela, valor);
    const texto = entrada?.texto ?? '(nenhuma entrada cobre esse valor — gap na tabela)';
    setResultado({ rolagem: valor, texto, tabelaNome: tabela.nome });
    const tag = entrada ? '' : ' [gap]';
    registrarLog('anotacao', `${tabela.nome} · d${tabela.lados} → ${valor} — ${texto}${tag}`, null, 'privada');
  };

  return (
    <section className="secao">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="label" style={{ margin: 0 }}>Tabelas</h3>
        <button
          className="icone-botao"
          onClick={() => setModo((m) => (m === 'rolar' ? 'editar' : 'rolar'))}
          title={modo === 'rolar' ? 'editar tabelas' : 'voltar a rolar'}
          style={{ fontSize: 11 }}
        >
          {modo === 'rolar' ? 'editar' : 'rolar'}
        </button>
      </div>

      {modo === 'rolar' && (
        <>
          <div className="campos-grid" style={{ gridTemplateColumns: '1fr', marginTop: '0.5rem' }}>
            <div>
              <label htmlFor="rt-tabela">Tabela</label>
              <select id="rt-tabela" value={tabelaId} onChange={(e) => { setTabelaId(e.target.value); setResultado(null); }}>
                <option value="">— selecione —</option>
                {tabelas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome} (d{t.lados})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button className="acento" style={{ marginTop: '0.75rem' }} disabled={!tabela} onClick={rolar}>
            rolar{tabela ? ` ${tabela.nome}` : ''}
          </button>

          {resultado && (
            <div className="alerta-banner mono" style={{ marginTop: '0.75rem', borderColor: 'var(--real)', color: 'var(--real)' }}>
              <span>
                d{tabela?.lados} → {resultado.rolagem}{'\n'}{resultado.texto}
              </span>
            </div>
          )}
        </>
      )}

      {modo === 'editar' && (
        <>
          <div className="campos-grid" style={{ gridTemplateColumns: '1fr', marginTop: '0.5rem' }}>
            <div>
              <label htmlFor="rt-edit-tabela">Tabela</label>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <select
                  id="rt-edit-tabela"
                  value={tabelaId}
                  onChange={(e) => setTabelaId(e.target.value)}
                >
                  {tabelas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome} (d{t.lados})
                    </option>
                  ))}
                </select>
                <button className="icone-botao acento" onClick={() => setTabelaId(adicionarTabela())} title="nova tabela" style={{ whiteSpace: 'nowrap' }}>+</button>
                {tabelas.length > 1 && (
                  <button
                    className="icone-botao"
                    onClick={() => { if (tabela && window.confirm(`apagar a tabela "${tabela.nome}"?`)) { removerTabela(tabela.id); setTabelaId(''); } }}
                    title="apagar tabela"
                    style={{ color: 'var(--ruido)' }}
                  >×</button>
                )}
              </div>
            </div>
          </div>

          {tabela && (
            <>
              <div className="campos-grid" style={{ gridTemplateColumns: '2fr 1fr', marginTop: '0.5rem' }}>
                <div>
                  <label htmlFor="rt-nome">Nome</label>
                  <input id="rt-nome" value={tabela.nome} onChange={(e) => atualizarTabela(tabela.id, { nome: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="rt-lados">Faces</label>
                  <input id="rt-lados" type="number" min={2} max={100} value={tabela.lados} onChange={(e) => atualizarTabela(tabela.id, { lados: Math.max(2, Math.min(100, Number(e.target.value) || 2)) })} />
                </div>
              </div>

              {(() => {
                const problemas = validarCoberturaTabela(tabela);
                return problemas.length > 0 ? (
                  <p className="vazio" style={{ color: 'var(--ruido)', fontSize: 11, marginTop: '0.4rem' }}>
                    {problemas.join(' · ')}
                  </p>
                ) : null;
              })()}

              <div style={{ marginTop: '0.6rem' }}>
                {tabela.entradas.map((e, i) => (
                  <div key={e.id} style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start', marginBottom: '0.3rem' }}>
                    <input
                      type="number"
                      min={1}
                      max={tabela.lados}
                      value={e.min}
                      onChange={(ev) => atualizarEntradaTabela(tabela.id, e.id, { min: Number(ev.target.value) || 1 })}
                      style={{ width: 42, flexShrink: 0 }}
                      title="mínimo"
                    />
                    <span className="vazio" style={{ paddingTop: '0.35rem', fontSize: 12 }}>a</span>
                    <input
                      type="number"
                      min={1}
                      max={tabela.lados}
                      value={e.max}
                      onChange={(ev) => atualizarEntradaTabela(tabela.id, e.id, { max: Number(ev.target.value) || 1 })}
                      style={{ width: 42, flexShrink: 0 }}
                      title="máximo"
                    />
                    <input
                      value={e.texto}
                      onChange={(ev) => atualizarEntradaTabela(tabela.id, e.id, { texto: ev.target.value })}
                      placeholder={`entrada ${i + 1}`}
                      style={{ flex: 1 }}
                    />
                    <button
                      className="icone-botao"
                      onClick={() => removerEntradaTabela(tabela.id, e.id)}
                      title="remover entrada"
                      style={{ color: 'var(--ruido)', flexShrink: 0 }}
                    >×</button>
                  </div>
                ))}
                <button
                  className="icone-botao acento"
                  onClick={() => adicionarEntradaTabela(tabela.id)}
                  style={{ fontSize: 11, marginTop: '0.2rem' }}
                >+ entrada</button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}