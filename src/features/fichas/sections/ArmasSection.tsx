import { useState } from 'react';
import { rolarDadosComForcados } from '../../../dice/registroForcados';
import { ARMAS, PROTECOES } from '../../../rules/data/armas';
import { PERICIAS } from '../../../rules/data/pericias';
import { calcularPvMaximo, estaFerido } from '../../../rules/derivados';
import { parseDanoArma, resolverDanoArma } from '../../../rules/teste';
import { useStore } from '../../../state/store';
import type { ArmaFicha } from '../../../state/types';
import type { SecaoFichaProps } from '../tipos';

export default function ArmasSection({ ficha, onChange, souMestre }: SecaoFichaProps) {
  const basePV = useStore((s) => s.config.basePV);
  const registrarLog = useStore((s) => s.registrarLog);
  const registrarRoll = useStore((s) => s.registrarRoll);
  const [arsenalSelect, setArsenalSelect] = useState('');
  // Privado por padrão só faz sentido pro mestre — o jogador rolando a própria arma continua
  // sempre público, sem opção (comportamento inalterado). Ver `souMestre` em `tipos.ts`.
  const [privado, setPrivado] = useState(true);
  const visibilidade = souMestre && privado ? 'privada' : 'publica';
  const [protecaoSelect, setProtecaoSelect] = useState('');
  /** "margem 10+ (ou 20 natural)" no ataque — 100% manual (a rolagem de ataque não compara mais
   *  contra a DT da cena, então não há margem pra pré-marcar sozinho): o mestre marca à mão,
   *  narrativamente, antes de clicar "dano" pra este disparo específico usar dano máximo em vez
   *  da rolagem (regras.md). Por linha de arma, não persiste — é um flag de "próxima rolagem". */
  const [margem10Mais, setMargem10Mais] = useState<Record<string, boolean>>({});
  /** Resultado da última rolagem de dano por arma — mostrado na própria ficha (não só no log),
   *  pro jogador ver na hora sem precisar abrir a aba Log. */
  const [resultados, setResultados] = useState<Record<string, { texto: string; erro: boolean }>>({});
  /** Resultado da última rolagem de ATAQUE por arma — mesmo espírito do `resultados` acima. */
  const [resultadosAtaque, setResultadosAtaque] = useState<Record<string, string>>({});

  const rolarAtaque = (arma: ArmaFicha) => {
    if (!arma.periciaAtaqueId) return;
    const pericia = PERICIAS.find((p) => p.id === arma.periciaAtaqueId);
    if (!pericia) return;
    const grauPericia = ficha.pericias[pericia.id] ?? 0;
    const pvMaximo = calcularPvMaximo(basePV, ficha.atributos.vigor);
    const ferido = estaFerido(ficha.pvAtual, pvMaximo);
    const [d20] = rolarDadosComForcados(1, 20, ficha.id, 'teste');
    const nomePersonagem = ficha.nome || 'Personagem';
    const nomeArma = arma.nome || 'arma';

    const penalidadeFerido = ferido && (pericia.atributo === 'vigor' || pericia.atributo === 'agilidade') ? -2 : 0;
    const modificador = ficha.atributos[pericia.atributo] + grauPericia + penalidadeFerido;
    const total = d20 + modificador;
    const modStr = modificador >= 0 ? `+${modificador}` : `${modificador}`;
    registrarLog('teste', `${nomePersonagem} · ${nomeArma} · ataque → 1d20: ${d20}${modStr} = ${total}`, ficha.id, visibilidade);
    registrarRoll({ origem: nomePersonagem, personagemId: ficha.id, formula: `d20${modStr}`, total, bruto: d20, visibilidade });
    setResultadosAtaque((prev) => ({ ...prev, [arma.id]: `d20=${d20}${modStr}=${total}` }));
  };

  const rolarDano = (arma: ArmaFicha) => {
    const parsed = parseDanoArma(arma.dano);
    const critico = margem10Mais[arma.id] ?? false;
    // Em crítico, o dado nem precisa ser rolado de verdade — `resolverDanoArma` usa o máximo do
    // dado de qualquer jeito (regras.md, margem 10+/20 natural), então rolar só confundiria a
    // exibição com um valor que não afeta o resultado. Sem `parsed`, não tem quantidade/lados
    // pra rolar — `resolverDanoArma` cai no próprio branch de erro com a lista vazia.
    const valoresDados = parsed && !critico ? rolarDadosComForcados(parsed.qtd, parsed.lados, ficha.id, 'dano') : [];
    const resultado = resolverDanoArma(arma, valoresDados, ficha.atributos.vigor, critico);

    const nomeArma = arma.nome || 'arma';
    const nomePersonagem = ficha.nome || 'Personagem';
    registrarLog('dano', `${nomePersonagem} · ${nomeArma} · ${resultado.texto}`, ficha.id, visibilidade);
    registrarRoll({
      origem: nomePersonagem,
      personagemId: ficha.id,
      formula: arma.dano,
      total: resultado.total,
      bruto: resultado.bruto,
      visibilidade,
    });
    setResultados((prev) => ({ ...prev, [arma.id]: { texto: resultado.texto, erro: resultado.erro } }));
    // "crít." é flag de "próxima rolagem" (comentário acima) — desarma sozinho depois de
    // aplicado, senão fica "armado" e infla silenciosamente o próximo ataque normal.
    setMargem10Mais((prev) => ({ ...prev, [arma.id]: false }));
  };
  const atualizar = (id: string, patch: Partial<ArmaFicha>) => {
    onChange({ armas: ficha.armas.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  };

  const remover = (id: string) => {
    onChange({ armas: ficha.armas.filter((a) => a.id !== id) });
  };

  const adicionarVazia = () => {
    const nova: ArmaFicha = { id: crypto.randomUUID(), nome: '', bonusAtaque: '', dano: '', alcance: '', nota: '', periciaAtaqueId: null };
    onChange({ armas: [...ficha.armas, nova] });
  };

  const adicionarDoArsenal = (nomeArma: string) => {
    const def = ARMAS.find((a) => a.nome === nomeArma);
    if (!def) return;
    const nova: ArmaFicha = {
      id: crypto.randomUUID(),
      nome: def.nome,
      bonusAtaque: def.somaVigor ? 'Vigor + Briga' : 'Agilidade + Pontaria',
      dano: def.somaVigor ? `${def.dano} + Vigor` : def.dano,
      alcance: `${def.alcanceMetros} m`,
      nota: def.nota,
      periciaAtaqueId: def.somaVigor ? 'briga' : 'pontaria',
    };
    onChange({ armas: [...ficha.armas, nova] });
  };

  const aplicarProtecao = (nomeProtecao: string) => {
    const def = PROTECOES.find((p) => p.nome === nomeProtecao);
    if (!def) return;
    onChange({ equipamentoModificadorDefesa: def.defesa });
  };

  return (
    <section className="secao">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <h3 className="label" style={{ margin: 0 }}>
          Armas e Proteção
        </h3>
        {souMestre && (
          <label
            title="ataque e dano rolados aqui nascem privados por padrão — desmarque pra rolar público"
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '11px', cursor: 'pointer' }}
          >
            <input type="checkbox" checked={privado} onChange={(e) => setPrivado(e.target.checked)} />
            privado
          </label>
        )}
      </div>
      {ficha.armas.length > 0 && (
        <table className="armas-tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Ataque (d20 + …)</th>
              <th>Dano</th>
              <th>Alcance</th>
              <th>Nota</th>
              <th>Rolar</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {ficha.armas.map((a) => (
              <tr key={a.id}>
                <td>
                  <input value={a.nome} onChange={(e) => atualizar(a.id, { nome: e.target.value })} />
                </td>
                <td>
                  <input value={a.bonusAtaque} onChange={(e) => atualizar(a.id, { bonusAtaque: e.target.value })} />
                </td>
                <td>
                  <input value={a.dano} onChange={(e) => atualizar(a.id, { dano: e.target.value })} />
                </td>
                <td>
                  <input value={a.alcance} onChange={(e) => atualizar(a.id, { alcance: e.target.value })} />
                </td>
                <td>
                  <input value={a.nota} onChange={(e) => atualizar(a.id, { nota: e.target.value })} />
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <select
                      value={a.periciaAtaqueId ?? ''}
                      title="perícia que governa o ataque desta arma"
                      onChange={(e) => atualizar(a.id, { periciaAtaqueId: e.target.value || null })}
                      style={{ maxWidth: 110 }}
                    >
                      <option value="">— perícia —</option>
                      {PERICIAS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => rolarAtaque(a)} disabled={!a.periciaAtaqueId}>
                      atacar
                    </button>
                    <button onClick={() => rolarDano(a)} disabled={a.dano.trim() === ''}>
                      dano
                    </button>
                    <label
                      title="margem 10+ ou 20 natural no ataque — usa o máximo do dado"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '11px', cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        checked={margem10Mais[a.id] ?? false}
                        onChange={(e) => setMargem10Mais((prev) => ({ ...prev, [a.id]: e.target.checked }))}
                      />
                      crít.
                    </label>
                  </div>
                  {resultadosAtaque[a.id] && (
                    <div className="mono" style={{ marginTop: '0.3rem', fontSize: '11px', whiteSpace: 'nowrap', color: 'var(--rede)' }}>
                      {resultadosAtaque[a.id]}
                    </div>
                  )}
                  {resultados[a.id] && (
                    <div
                      className="mono"
                      style={{
                        marginTop: '0.3rem',
                        fontSize: '11px',
                        whiteSpace: 'nowrap',
                        color: resultados[a.id].erro ? 'var(--ruido)' : 'var(--rede)',
                      }}
                    >
                      {resultados[a.id].texto}
                    </div>
                  )}
                </td>
                <td>
                  <button className="icone-botao perigo" onClick={() => remover(a.id)}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="acento" onClick={adicionarVazia}>
          + arma livre
        </button>
        <select
          value={arsenalSelect}
          onChange={(e) => {
            const val = e.target.value;
            setArsenalSelect('');
            if (val) adicionarDoArsenal(val);
          }}
        >
          <option value="">+ do arsenal…</option>
          {ARMAS.map((a) => (
            <option key={a.nome} value={a.nome}>
              {a.nome}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: '1rem', display: 'grid', gap: '0.6rem' }}>
        <h4 className="label" style={{ margin: 0 }}>
          Proteção
        </h4>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={protecaoSelect}
            onChange={(e) => {
              const val = e.target.value;
              setProtecaoSelect('');
              if (val) aplicarProtecao(val);
            }}
          >
            <option value="">+ proteção…</option>
            {PROTECOES.map((p) => (
              <option key={p.nome} value={p.nome}>
                {p.nome} — {p.preco}
              </option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', margin: 0 }}>
            <span className="vazio">bônus de defesa</span>
            <input
              type="number"
              value={ficha.equipamentoModificadorDefesa}
              onChange={(e) => onChange({ equipamentoModificadorDefesa: Number(e.target.value) || 0 })}
              style={{ width: 72 }}
            />
          </label>
        </div>
        <p className="vazio">A proteção escolhida soma no cálculo de Defesa da ficha.</p>
      </div>
    </section>
  );
}
