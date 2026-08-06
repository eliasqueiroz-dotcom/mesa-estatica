import { useState } from 'react';
import type { ColorsetId } from '../../dice/colorsets';
import type { RollGroupResult, RollTermo } from '../../dice/useDiceBox';
import { calcularPvMaximo, estaFerido } from '../../rules/derivados';
import { calcularPerdaSanidade } from '../../rules/sanidade';
import { PERDA_SANIDADE, type GatilhoSanidade } from '../../rules/data/dificuldades';
import { resolverTeste } from '../../rules/teste';
import { useStore } from '../../state/store';
import { useDtDaCena } from './useDtDaCena';

export function parseDado(dado: string): RollTermo {
  const [qty, sides] = dado.split('d').map(Number);
  return { qty, sides };
}

export function extrairResultadosSanidade(grupos: RollGroupResult[], perdaTermo: RollTermo) {
  // `usados` evita que o d20 do teste de Vontade e o dado de perda apontem pro MESMO grupo
  // quando os dois critérios colidem (ex: se um gatilho futuro de PERDA_SANIDADE usar 1d20 — hoje
  // só 1d4/1d8/2d8 existem, então isso nunca dispara em uso normal, mas sem essa exclusão o
  // segundo `.find()` reencontraria o grupo já usado pelo primeiro, e um dos dois valores reais
  // seria descartado em silêncio).
  const usados = new Set<RollGroupResult>();

  const d20Grupo = grupos.find((g) => !usados.has(g) && Number(g.sides) === 20) ?? grupos[0];
  if (d20Grupo) usados.add(d20Grupo);

  const perdaGrupo =
    grupos.find((g) => !usados.has(g) && Number(g.sides) === perdaTermo.sides && Number(g.qty) === perdaTermo.qty) ??
    grupos.find((g) => !usados.has(g) && Number(g.sides) === perdaTermo.sides) ??
    grupos.find((g) => !usados.has(g)) ??
    grupos.at(-1);

  return {
    d20: d20Grupo?.rolls?.[0]?.value ?? 0,
    perdaRolada: perdaGrupo?.value ?? perdaGrupo?.rolls?.[0]?.value ?? 0,
  };
}

interface RoladorSanidadeProps {
  ready: boolean;
  rolar: (
    notacao: RollTermo[],
    onComplete: (r: RollGroupResult[]) => void,
    colorset?: ColorsetId,
    personagemId?: string | null,
  ) => void;
}

export default function RoladorSanidade({ ready, rolar }: RoladorSanidadeProps) {
  const fichas = useStore((s) => s.fichas);
  const basePV = useStore((s) => s.config.basePV);
  const ajustarSanidadeAtual = useStore((s) => s.ajustarSanidadeAtual);

  const [fichaId, setFichaId] = useState('');
  const [gatilhoId, setGatilhoId] = useState<GatilhoSanidade>('perturbador');
  const [rolando, setRolando] = useState(false);
  const [resultado, setResultado] = useState<{ sucesso: boolean; d20: number; perdaRolada: number; perda: number } | null>(
    null,
  );

  const ficha = fichas.find((f) => f.id === fichaId) ?? null;
  const gatilho = PERDA_SANIDADE.find((g) => g.id === gatilhoId)!;
  const dt = useDtDaCena();

  const rolarSanidade = () => {
    if (!ficha) return;
    setRolando(true);
    const perdaTermo = parseDado(gatilho.dado);
    rolar([{ sides: 20, qty: 1 }, perdaTermo], (grupos) => {
      const { d20, perdaRolada } = extrairResultadosSanidade(grupos, perdaTermo);

      const pvMaximo = calcularPvMaximo(basePV, ficha.atributos.vigor);
      const ferido = estaFerido(ficha.pvAtual, pvMaximo);
      const teste = resolverTeste({
        d20,
        atributoId: 'vontade',
        valorAtributo: ficha.atributos.vontade,
        grauPericia: 0,
        personagemFerido: ferido,
        dt,
      });
      const perda = calcularPerdaSanidade(perdaRolada, teste.sucesso);

      setResultado({ sucesso: teste.sucesso, d20, perdaRolada, perda });
      setRolando(false);

      ajustarSanidadeAtual(ficha.id, ficha.sanidadeAtual - perda);
    }, 'ruido', ficha.id);
  };

  return (
    <section className="secao">
      <h3 className="label">Rolador de Sanidade</h3>

      <div className="campos-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div>
          <label htmlFor="rs-ficha">Personagem</label>
          <select id="rs-ficha" value={fichaId} onChange={(e) => setFichaId(e.target.value)}>
            <option value="">— selecione —</option>
            {fichas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome || 'sem nome'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="rs-gatilho">Gatilho</label>
          <select id="rs-gatilho" value={gatilhoId} onChange={(e) => setGatilhoId(e.target.value as GatilhoSanidade)}>
            {PERDA_SANIDADE.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome} ({g.dado})
              </option>
            ))}
          </select>
        </div>
      </div>

      <button className="acento" style={{ marginTop: '0.75rem' }} disabled={!ready || !ficha || rolando} onClick={rolarSanidade}>
        rolar Vontade + {gatilho.dado}
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
            d20={resultado.d20} — {resultado.sucesso ? 'sucesso' : 'falha'} · rolou {resultado.perdaRolada} de Sanidade,
            perdeu {resultado.perda}
          </span>
        </div>
      )}
    </section>
  );
}
