import { useState } from 'react';
import type { ColorsetId } from '../../dice/colorsets';
import type { RollGroupResult, RollTermo } from '../../dice/useDiceBox';
import type { TipoRolagemForcada } from '../../dice/registroForcados';
import { calcularPvMaximo, estaFerido } from '../../rules/derivados';
import { resolverTeste, type ResultadoTeste } from '../../rules/teste';
import { useStore } from '../../state/store';
import type { Ficha } from '../../state/types';

/** DT fixa (não useDtDaCena) — trauma é contra o próprio passado, não contra a dificuldade
 *  externa da cena. Intencional — e é exatamente por isso que este rolador (diferente do de
 *  Sanidade) pode aplicar a consequência sozinho: a DT não é segredo do mestre. */
const DT_GATILHO = 12;

interface Props {
  ficha: Ficha;
  ready: boolean;
  rolar: (
    notacao: RollTermo[],
    onComplete: (r: RollGroupResult[]) => void,
    colorset?: ColorsetId,
    personagemId?: string | null,
    tipo?: TipoRolagemForcada,
    bonus?: number,
  ) => void;
}

/** Gatilho de Trauma do jogador — versão reduzida de `RoladorTrauma.tsx` pra própria ficha. */
export default function RoladorTraumaJogador({ ficha, ready, rolar }: Props) {
  const basePV = useStore((s) => s.config.basePV);
  const ajustarSanidadeAtual = useStore((s) => s.ajustarSanidadeAtual);
  const ajustarDeterminacao = useStore((s) => s.ajustarDeterminacao);
  const registrarLog = useStore((s) => s.registrarLog);

  const [traumaId, setTraumaId] = useState('');
  const [rolando, setRolando] = useState(false);
  const [teste, setTeste] = useState<ResultadoTeste | null>(null);
  const [resolvido, setResolvido] = useState(false);

  const traumasAtivos = ficha.traumas.filter((t) => !t.virouCicatriz);
  const trauma = traumasAtivos.find((t) => t.id === traumaId) ?? null;

  const rolarGatilho = () => {
    if (!trauma) return;
    setRolando(true);
    setTeste(null);
    setResolvido(false);
    const pvMaximo = calcularPvMaximo(basePV, ficha.atributos.vigor);
    const ferido = estaFerido(ficha.pvAtual, pvMaximo);
    // mesma fórmula de resolverTeste (não dá pra chamá-la antes de ter o d20) — penalidade de
    // ferido só se aplica a vigor/agilidade, então pra vontade o modificador é só o atributo.
    const modificador = ficha.atributos.vontade;
    rolar(
      [{ sides: 20, qty: 1 }],
      (grupos) => {
        const d20 = grupos[0].rolls[0].value;
        const r = resolverTeste({
          d20,
          atributoId: 'vontade',
          valorAtributo: ficha.atributos.vontade,
          grauPericia: 0,
          personagemFerido: ferido,
          dt: DT_GATILHO,
        });
        setTeste(r);
        setRolando(false);
        if (r.sucesso) setResolvido(true);
        registrarLog('trauma', `${ficha.nome || 'Personagem'} · teste de trauma "${trauma.nome}"(Vontade) vs DT${DT_GATILHO} → 1d20: ${r.d20} = ${r.total} · ${r.sucesso ? 'segura' : 'falha'}`, ficha.id, 'publica');
      },
      'ruido',
      ficha.id,
      undefined,
      modificador || undefined,
    );
  };

  const perderSanidade = () => {
    if (!trauma) return;
    rolar(
      [{ sides: 4, qty: 1 }],
      (grupos) => {
        const perda = grupos[0].value;
        ajustarSanidadeAtual(ficha.id, ficha.sanidadeAtual - perda);
        registrarLog('trauma', `${ficha.nome || 'Personagem'} · trauma "${trauma.nome}" · perde 1d4 (${perda}) de Sanidade`, ficha.id, 'publica');
        setResolvido(true);
      },
      'ruido',
      ficha.id,
    );
  };

  const interpretar = () => {
    if (!trauma) return;
    ajustarDeterminacao(ficha.id, ficha.determinacao + 1);
    registrarLog('trauma', `${ficha.nome || 'Personagem'} · trauma "${trauma.nome}" · interpretou a Resposta, +1 Determinação`, ficha.id, 'publica');
    setResolvido(true);
  };

  return (
    <section className="secao">
      <h3 className="label">Gatilho de Trauma em cena</h3>

      <div className="campos-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div>
          <label htmlFor="rtrj-trauma">Trauma</label>
          <select
            id="rtrj-trauma"
            value={traumaId}
            onChange={(e) => {
              setTraumaId(e.target.value);
              setTeste(null);
            }}
          >
            <option value="">— selecione —</option>
            {traumasAtivos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome || 'sem nome'}
              </option>
            ))}
          </select>
        </div>
      </div>
      {traumasAtivos.length === 0 && <p className="vazio">nenhum trauma ativo (não-cicatriz) nesta ficha.</p>}

      <button className="acento" style={{ marginTop: '0.75rem' }} disabled={!ready || !trauma || rolando} onClick={rolarGatilho}>
        rolar Vontade vs DT{DT_GATILHO}
      </button>

      {teste && (
        <div
          className="alerta-banner mono"
          style={{
            marginTop: '0.75rem',
            borderColor: teste.sucesso ? 'var(--rede)' : 'var(--ruido)',
            color: teste.sucesso ? 'var(--rede)' : 'var(--ruido)',
          }}
        >
          <span>
            d20={teste.d20} vs DT{DT_GATILHO} — {teste.sucesso ? 'segura o gatilho' : 'falha'}
          </span>
        </div>
      )}

      {teste && !teste.sucesso && !resolvido && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
          <button className="perigo" onClick={perderSanidade}>
            perder 1d4 Sanidade
          </button>
          <button className="acento" onClick={interpretar}>
            interpretar a Resposta (+1 Determinação)
          </button>
        </div>
      )}
    </section>
  );
}
