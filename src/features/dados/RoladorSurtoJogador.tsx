import { useState } from 'react';
import type { ColorsetId } from '../../dice/colorsets';
import type { RollGroupResult, RollTermo } from '../../dice/useDiceBox';
import { calcularExpiraSurto, resolverSurto, type ResultadoSurto } from '../../rules/surto';
import { useStore } from '../../state/store';
import type { Ficha } from '../../state/types';

interface Props {
  ficha: Ficha;
  ready: boolean;
  rolar: (
    notacao: RollTermo[],
    onComplete: (r: RollGroupResult[]) => void,
    colorset?: ColorsetId,
    personagemId?: string | null,
  ) => void;
}

/**
 * Rolador de Surto do jogador — versão reduzida de `RoladorSurto.tsx` pra própria ficha.
 * Sem dependência de DT secreta (2d20 comparados entre si, `resolverSurto` é puro) — seguro
 * pra automação completa igual ao mestre. A escolha do lado A/B já era pensada pra ser
 * inline na própria ficha (ROADMAP 19/07: "escolha de efeito do Surto passa de modal do
 * mestre pra inline na própria ficha do personagem") — aqui é literalmente isso.
 */
export default function RoladorSurtoJogador({ ficha, ready, rolar }: Props) {
  const dispararBurstRuido = useStore((s) => s.dispararBurstRuido);
  const atualizarFicha = useStore((s) => s.atualizarFicha);
  const resolverEscolhaSurtoPendente = useStore((s) => s.resolverEscolhaSurtoPendente);
  const sessaoPublica = useStore((s) => s.sessaoPublica);

  const [rolando, setRolando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoSurto | null>(null);
  const [escolhido, setEscolhido] = useState<'A' | 'B' | null>(null);

  const rolarSurto = () => {
    setRolando(true);
    setResultado(null);
    setEscolhido(null);
    useStore.setState((s) => {
      const { [ficha.id]: _, ...resto } = s.escolhasSurtoPendentes;
      return { escolhasSurtoPendentes: resto };
    });
    rolar(
      [{ sides: 20, qty: 2 }],
      (grupos) => {
        const [d20A, d20B] = grupos[0].rolls.map((r) => r.value);
        const r = resolverSurto(d20A, d20B);
        setResultado(r);
        setRolando(false);
        dispararBurstRuido();
        if (r.mesmoNumero) {
          atualizarFicha(ficha.id, {
            surtosAtivos: [
              ...(ficha.surtosAtivos ?? []),
              { id: crypto.randomUUID(), expiraEm: calcularExpiraSurto(sessaoPublica), escolha: r.entradaA.nome },
            ],
          });
        } else {
          atualizarFicha(ficha.id, {
            surtosAtivos: [
              ...(ficha.surtosAtivos ?? []).filter((s) => s.escolha !== null),
              { id: crypto.randomUUID(), expiraEm: calcularExpiraSurto(sessaoPublica), escolha: null },
            ],
          });
          useStore.setState((s) => ({
            escolhasSurtoPendentes: {
              ...s.escolhasSurtoPendentes,
              [ficha.id]: { nomeFicha: ficha.nome ?? 'Personagem', entradaA: r.entradaA, entradaB: r.entradaB },
            },
          }));
        }
      },
      'ruido',
      ficha.id,
    );
  };

  const escolher = (lado: 'A' | 'B') => {
    if (!resultado) return;
    setEscolhido(lado);
    resolverEscolhaSurtoPendente(ficha.id, lado);
  };

  return (
    <section className="secao">
      <h3 className="label">Rolador de Surto</h3>

      <button className="perigo" disabled={!ready || rolando} onClick={rolarSurto}>
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
