import { useState } from 'react';
import type { RollGroupResult, RollTermo } from '../../dice/useDiceBox';
import { resolverSurto, type ResultadoSurto } from '../../rules/surto';
import { useStore } from '../../state/store';

interface RoladorSurtoProps {
  ready: boolean;
  rolar: (notacao: RollTermo[], onComplete: (r: RollGroupResult[]) => void) => void;
}

export default function RoladorSurto({ ready, rolar }: RoladorSurtoProps) {
  const fichas = useStore((s) => s.fichas);
  const registrarLog = useStore((s) => s.registrarLog);

  const [fichaId, setFichaId] = useState('');
  const [rolando, setRolando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoSurto | null>(null);
  const [escolhido, setEscolhido] = useState<'A' | 'B' | null>(null);

  const ficha = fichas.find((f) => f.id === fichaId) ?? null;

  const rolarSurto = () => {
    if (!ficha) return;
    setRolando(true);
    setEscolhido(null);
    rolar([{ sides: 20, qty: 2 }], (grupos) => {
      const [d20A, d20B] = grupos[0].rolls.map((r) => r.value);
      const r = resolverSurto(d20A, d20B);
      setResultado(r);
      setRolando(false);
      if (r.mesmoNumero) {
        registrarLog(
          'surto',
          `${ficha.nome || 'Personagem'} · Surto · d20=${d20A}/${d20B} · o destino insiste: ${r.entradaA.nome} — ${r.entradaA.descricao}`,
          ficha.id,
        );
      }
    });
  };

  const escolher = (lado: 'A' | 'B') => {
    if (!ficha || !resultado) return;
    const entrada = lado === 'A' ? resultado.entradaA : resultado.entradaB;
    setEscolhido(lado);
    registrarLog(
      'surto',
      `${ficha.nome || 'Personagem'} · Surto · d20=${resultado.d20A}/${resultado.d20B} · escolhido: ${entrada.nome} — ${entrada.descricao}`,
      ficha.id,
    );
  };

  return (
    <section className="secao">
      <h3 className="label">Rolador de Surto</h3>

      <div className="campos-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div>
          <label htmlFor="rsu-ficha">Personagem</label>
          <select id="rsu-ficha" value={fichaId} onChange={(e) => setFichaId(e.target.value)}>
            <option value="">— selecione —</option>
            {fichas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome || 'sem nome'}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button className="perigo" style={{ marginTop: '0.75rem' }} disabled={!ready || !ficha || rolando} onClick={rolarSurto}>
        rolar surto (2d20)
      </button>

      {resultado && resultado.mesmoNumero && (
        <div className="alerta-banner mono" style={{ marginTop: '0.75rem' }}>
          <span>
            d20={resultado.d20A}/{resultado.d20B} — o destino insiste: <strong>{resultado.entradaA.nome}</strong> —{' '}
            {resultado.entradaA.descricao}
          </span>
        </div>
      )}

      {resultado && !resultado.mesmoNumero && (
        <div className="campos-grid" style={{ marginTop: '0.75rem' }}>
          {(['A', 'B'] as const).map((lado) => {
            const entrada = lado === 'A' ? resultado.entradaA : resultado.entradaB;
            const d20 = lado === 'A' ? resultado.d20A : resultado.d20B;
            return (
              <div
                key={lado}
                className="alerta-banner mono"
                style={{
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '0.4rem',
                  borderColor: escolhido === lado ? 'var(--rede)' : undefined,
                }}
              >
                <span>
                  d20={d20} — <strong>{entrada.nome}</strong>
                </span>
                <span style={{ fontFamily: 'var(--font-body)' }}>{entrada.descricao}</span>
                <button className="acento" onClick={() => escolher(lado)} disabled={escolhido !== null}>
                  {escolhido === lado ? 'escolhido' : 'escolher este'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
