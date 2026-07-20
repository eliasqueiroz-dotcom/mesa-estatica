import { useState } from 'react';
import type { ColorsetId } from '../../dice/colorsets';
import type { RollGroupResult } from '../../dice/useDiceBox';
import { calcularPvMaximo, estaFerido } from '../../rules/derivados';
import { ATRIBUTOS, PERICIAS } from '../../rules/data/pericias';
import { resolverTeste, type ResultadoTeste } from '../../rules/teste';
import { useStore } from '../../state/store';
import { useDtDaCena } from './useDtDaCena';

function descricaoResultado(r: ResultadoTeste): string {
  if (r.natural1) return '1 natural — complicação';
  if (r.natural20) return '20 natural — margem garantida';
  if (r.margem10Mais) return 'margem 10+ — efeito extra';
  return r.sucesso ? 'sucesso' : 'falha';
}

interface RoladorTesteProps {
  ready: boolean;
  rolar: (
    notacao: string,
    onComplete: (r: RollGroupResult[]) => void,
    colorset?: ColorsetId,
    personagemId?: string | null,
  ) => void;
}

export default function RoladorTeste({ ready, rolar }: RoladorTesteProps) {
  const fichas = useStore((s) => s.fichas);
  const basePV = useStore((s) => s.config.basePV);
  const registrarLog = useStore((s) => s.registrarLog);

  const [fichaId, setFichaId] = useState('');
  const [periciaId, setPericiaId] = useState(PERICIAS[0].id);
  const [resultado, setResultado] = useState<ResultadoTeste | null>(null);
  const [rolando, setRolando] = useState(false);

  const ficha = fichas.find((f) => f.id === fichaId) ?? null;
  const pericia = PERICIAS.find((p) => p.id === periciaId)!;
  const atributo = ATRIBUTOS.find((a) => a.id === pericia.atributo)!;
  const dt = useDtDaCena();

  const rolarTeste = () => {
    if (!ficha) return;
    setRolando(true);
    rolar('1d20', (grupos) => {
      const d20 = grupos[0]?.rolls[0]?.value ?? 0;
      const pvMaximo = calcularPvMaximo(basePV, ficha.atributos.vigor);
      const ferido = estaFerido(ficha.pvAtual, pvMaximo);
      const grauPericia = ficha.pericias[periciaId] ?? 0;
      const r = resolverTeste({
        d20,
        atributoId: pericia.atributo,
        valorAtributo: ficha.atributos[pericia.atributo],
        grauPericia,
        personagemFerido: ferido,
        dt,
      });
      setResultado(r);
      setRolando(false);
      registrarLog(
        'teste',
        `${ficha.nome || 'Personagem'} · ${atributo.nome}+${pericia.nome} → ${d20}${
          r.modificador >= 0 ? '+' : ''
        }${r.modificador} = ${r.total} · ${descricaoResultado(r)}`,
        ficha.id,
      );
    }, 'rede', ficha.id);
  };

  return (
    <section className="secao">
      <h3 className="label">Rolador de teste</h3>

      <div className="campos-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div>
          <label htmlFor="rt-ficha">Personagem</label>
          <select id="rt-ficha" value={fichaId} onChange={(e) => setFichaId(e.target.value)}>
            <option value="">— selecione —</option>
            {fichas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome || 'sem nome'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="rt-pericia">Perícia</label>
          <select id="rt-pericia" value={periciaId} onChange={(e) => setPericiaId(e.target.value)}>
            {PERICIAS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} ({ATRIBUTOS.find((a) => a.id === p.atributo)!.nome})
              </option>
            ))}
          </select>
        </div>
      </div>

      <button className="acento" style={{ marginTop: '0.75rem' }} disabled={!ready || !ficha || rolando} onClick={rolarTeste}>
        rolar d20
      </button>

      {resultado && (
        <div
          className="alerta-banner mono"
          style={{
            marginTop: '0.75rem',
            borderColor: resultado.sucesso ? 'var(--rede)' : 'var(--ruido)',
            color: resultado.sucesso ? 'var(--rede)' : 'var(--ruido)',
          }}
        >
          <span>
            d20={resultado.d20} {resultado.modificador >= 0 ? '+' : ''}
            {resultado.modificador} = {resultado.total} — {descricaoResultado(resultado)}
          </span>
        </div>
      )}
    </section>
  );
}
