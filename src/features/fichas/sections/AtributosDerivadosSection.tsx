import { useState } from 'react';
import {
  calcularAlerta,
  calcularDefesa,
  calcularPvMaximo,
  calcularSanidadeMaxima,
  calcularTierRuido,
  estaFerido,
  metade,
} from '../../../rules/derivados';
import { ATRIBUTOS } from '../../../rules/data/pericias';
import { useStore } from '../../../state/store';
import BarraSegmentada from '../BarraSegmentada';
import type { SecaoFichaProps } from '../tipos';

const NOME_TIER_RUIDO: Record<0 | 1 | 2 | 3, string> = {
  0: 'limpo',
  1: 'interferência',
  2: 'ruído',
  3: 'colapso',
};

export default function AtributosDerivadosSection({ ficha, onChange }: SecaoFichaProps) {
  const basePV = useStore((s) => s.config.basePV);
  const ajustarPvAtual = useStore((s) => s.ajustarPvAtual);
  const ajustarSanidadeAtual = useStore((s) => s.ajustarSanidadeAtual);
  const ajustarDeterminacao = useStore((s) => s.ajustarDeterminacao);
  const contadorCena = useStore((s) => s.sessaoPublica.contadorCena);
  const [alertas, setAlertas] = useState<string[]>([]);

  const pvMaximo = calcularPvMaximo(basePV, ficha.atributos.vigor);
  const sanidadeMaxima = calcularSanidadeMaxima(ficha.atributos.vontade);
  const defesa = calcularDefesa(ficha.atributos.agilidade, ficha.equipamentoModificadorDefesa);
  const alertaCalc = calcularAlerta(ficha.atributos.percepcao);
  const ferido = estaFerido(ficha.pvAtual, pvMaximo);
  const linhaSanidade = metade(sanidadeMaxima);
  const traumasAtivos = ficha.traumas.filter((t) => !t.virouCicatriz).length;
  const tierRuido = calcularTierRuido(ficha.sanidadeAtual, sanidadeMaxima);
  const surtoAtivoAgora = ficha.surtoAtivo === contadorCena;

  const handleSanidade = (valor: number) => {
    const resultado = ajustarSanidadeAtual(ficha.id, valor);
    const novosAlertas: string[] = [];
    // ambos podem disparar juntos: um Surto não dispensa marcar o Trauma da linha cruzada.
    if (resultado.cruzouLinhaSanidade) novosAlertas.push('a garoa chia — Sanidade cruzou a metade, marque um Trauma.');
    if (resultado.surtoDisparado) novosAlertas.push('SURTO — role duas vezes na tabela (aba Dados & Regras).');
    if (novosAlertas.length > 0) setAlertas(novosAlertas);
  };

  return (
    <section className="secao">
      <h3 className="label">Atributos</h3>
      <div className="atributos-grid">
        {ATRIBUTOS.map((a) => (
          <div key={a.id}>
            <label htmlFor={`atr-${a.id}`}>{a.nome}</label>
            <input
              id={`atr-${a.id}`}
              type="number"
              min={0}
              max={5}
              value={ficha.atributos[a.id]}
              onChange={(e) =>
                onChange({
                  atributos: {
                    ...ficha.atributos,
                    [a.id]: Math.max(0, Math.min(5, Number(e.target.value) || 0)),
                  },
                })
              }
            />
          </div>
        ))}
      </div>

      <div className="derivados-grid">
        <div className="derivado-card" data-ferido={ferido}>
          <div className="derivado-card__label">PV</div>
          <div className="derivado-card__valor">{pvMaximo}</div>
          <div className="derivado-card__atual">
            <span className="vazio">atual</span>
            <input
              type="number"
              value={ficha.pvAtual}
              onChange={(e) => ajustarPvAtual(ficha.id, Number(e.target.value) || 0)}
            />
          </div>
          <BarraSegmentada atual={ficha.pvAtual} maximo={pvMaximo} variante="pv" />
          {ferido && <span className="badge" style={{ marginTop: '0.4rem' }}>ferido</span>}
        </div>

        <div className="derivado-card">
          <div className="derivado-card__label">Sanidade (linha: {linhaSanidade})</div>
          <div className="derivado-card__valor">{sanidadeMaxima}</div>
          <div className="derivado-card__atual">
            <span className="vazio">atual</span>
            <input
              type="number"
              value={ficha.sanidadeAtual}
              onChange={(e) => handleSanidade(Number(e.target.value) || 0)}
            />
          </div>
          <BarraSegmentada atual={ficha.sanidadeAtual} maximo={sanidadeMaxima} variante="sanidade" tier={tierRuido} />
          <div className="vazio" style={{ marginTop: '0.3rem' }}>
            nível de ruído: {NOME_TIER_RUIDO[tierRuido]}
          </div>
        </div>

        <div className="derivado-card">
          <div className="derivado-card__label">Defesa</div>
          <div className="derivado-card__valor">{defesa}</div>
          <div className="derivado-card__atual">
            <span className="vazio">equip.</span>
            <input
              type="number"
              value={ficha.equipamentoModificadorDefesa}
              onChange={(e) => onChange({ equipamentoModificadorDefesa: Number(e.target.value) || 0 })}
            />
          </div>
        </div>

        <div className="derivado-card">
          <div className="derivado-card__label">Alerta</div>
          <div className="derivado-card__valor">{alertaCalc}</div>
        </div>
      </div>

      {alertas.map((texto, i) => (
        <div key={i} className="alerta-banner" style={{ marginTop: '0.6rem' }}>
          <span>{texto}</span>
          <button className="icone-botao" onClick={() => setAlertas((prev) => prev.filter((_, j) => j !== i))}>
            ok
          </button>
        </div>
      ))}

      {(traumasAtivos >= 3 || surtoAtivoAgora) && (
        <div className="badges-linha">
          {surtoAtivoAgora && (
            <span className="badge" style={{ borderColor: 'var(--ruido)', color: 'var(--ruido)' }}>
              surto ativo nesta cena
            </span>
          )}
          {traumasAtivos >= 3 && <span className="badge">à beira de se perder — 3+ traumas</span>}
        </div>
      )}

      <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <span className="label" style={{ fontSize: '12px' }}>
          Determinação
        </span>
        {[1, 2].map((n) => (
          <label key={n} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', margin: 0 }}>
            <input
              type="checkbox"
              checked={ficha.determinacao >= n}
              onChange={() => ajustarDeterminacao(ficha.id, ficha.determinacao >= n ? n - 1 : n)}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
