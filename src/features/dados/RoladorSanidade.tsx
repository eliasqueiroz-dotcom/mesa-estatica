import { useState } from 'react';
import type { ColorsetId } from '../../dice/colorsets';
import type { TipoRolagemForcada } from '../../dice/registroForcados';
import type { RollGroupResult, RollTermo } from '../../dice/useDiceBox';
import { calcularPerdaSanidade } from '../../rules/sanidade';
import { PERDA_SANIDADE, type GatilhoSanidade } from '../../rules/data/dificuldades';
import { useStore } from '../../state/store';

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
    tipo?: TipoRolagemForcada,
  ) => void;
}

export default function RoladorSanidade({ ready, rolar }: RoladorSanidadeProps) {
  const fichas = useStore((s) => s.fichas);
  const ajustarSanidadeAtual = useStore((s) => s.ajustarSanidadeAtual);

  const [fichaId, setFichaId] = useState('');
  const [gatilhoId, setGatilhoId] = useState<GatilhoSanidade>('perturbador');
  const [rolando, setRolando] = useState(false);
  const [resultado, setResultado] = useState<{ d20: number; perdaRolada: number; aplicado: { sucesso: boolean; perda: number } | null } | null>(
    null,
  );

  const ficha = fichas.find((f) => f.id === fichaId) ?? null;
  const gatilho = PERDA_SANIDADE.find((g) => g.id === gatilhoId)!;

  const rolarSanidade = () => {
    if (!ficha) return;
    setRolando(true);
    const perdaTermo = parseDado(gatilho.dado);
    rolar([{ sides: 20, qty: 1 }, perdaTermo], (grupos) => {
      const { d20, perdaRolada } = extrairResultadosSanidade(grupos, perdaTermo);
      setResultado({ d20, perdaRolada, aplicado: null });
      setRolando(false);
    }, 'ruido', ficha.id, 'sanidade');
  };

  // O app não decide mais sucesso/falha sozinho (regras.md: teste de Vontade vs. DT da
  // cena) — mostra só os dados brutos, o mestre compara com a DT que tiver em mente e
  // clica o resultado. Mesmo padrão de `RoladorSanidadeJogador.tsx` já usava do lado do
  // jogador ("aguarde o mestre confirmar quanto perde de verdade").
  const confirmarResultado = (sucesso: boolean) => {
    if (!ficha || !resultado || resultado.aplicado) return;
    const perda = calcularPerdaSanidade(resultado.perdaRolada, sucesso);
    setResultado({ ...resultado, aplicado: { sucesso, perda } });
    ajustarSanidadeAtual(ficha.id, ficha.sanidadeAtual - perda);
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

      {resultado && !resultado.aplicado && (
        <div className="alerta-banner mono" style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <span>
            d20={resultado.d20} · rolou {resultado.perdaRolada} de Sanidade — compare com a DT que tiver em mente e confirme
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => confirmarResultado(true)}>sucesso — perde {Math.floor(resultado.perdaRolada / 2)}</button>
            <button onClick={() => confirmarResultado(false)}>falha — perde {resultado.perdaRolada}</button>
          </div>
        </div>
      )}

      {resultado?.aplicado && (
        <div
          className="alerta-banner mono"
          style={{
            marginTop: '0.75rem',
            borderColor: resultado.aplicado.sucesso ? 'var(--rede)' : 'var(--ruido)',
            color: resultado.aplicado.sucesso ? 'var(--rede)' : 'var(--ruido)',
          }}
        >
          <span>
            d20={resultado.d20} — {resultado.aplicado.sucesso ? 'sucesso' : 'falha'} · rolou {resultado.perdaRolada} de
            Sanidade, perdeu {resultado.aplicado.perda}
          </span>
        </div>
      )}
    </section>
  );
}
