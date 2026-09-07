import { useEffect, useRef, useState } from 'react';
import type { ColorsetId } from '../../dice/colorsets';
import { formatarLogRolagem, type RollGroupResult, type RollTermo } from '../../dice/useDiceBox';
import { PERDA_SANIDADE, type GatilhoSanidade } from '../../rules/data/dificuldades';
import { useStore } from '../../state/store';
import type { Ficha } from '../../state/types';

// Duplicado de `RoladorSanidade.tsx` de propósito (poucas linhas, puro) — evita puxar aquele
// módulo (com o resto do rolador de mestre) pro bundle do jogador.
function parseDado(dado: string): RollTermo {
  const [qty, sides] = dado.split('d').map(Number);
  return { qty, sides };
}

function extrairResultadosSanidade(grupos: RollGroupResult[], perdaTermo: RollTermo) {
  const d20Grupo = grupos.find((g) => Number(g.sides) === 20) ?? grupos[0];
  const perdaGrupo =
    grupos.find((g) => Number(g.sides) === perdaTermo.sides && Number(g.qty) === perdaTermo.qty) ??
    grupos.find((g) => Number(g.sides) === perdaTermo.sides) ??
    grupos.at(-1);

  return {
    d20: d20Grupo?.rolls?.[0]?.value ?? 0,
    perdaRolada: perdaGrupo?.value ?? perdaGrupo?.rolls?.[0]?.value ?? 0,
  };
}

interface Props {
  ficha: Ficha;
  ready: boolean;
  rolar: (
    notacao: RollTermo[],
    onComplete: (r: RollGroupResult[]) => void,
    colorset?: ColorsetId,
    personagemId?: string | null,
  ) => void;
  /** Incrementado por `PlayerApp.tsx` a partir do botão "rolar" no lembrete de Sanidade do log
   *  (`LogTabJogador.tsx` → `rolagemRapidaSanidadeStore`) — ao mudar, força o gatilho
   *  'perturbador' (mesmo dado 1d4 do "ver aliado a 0 PV", regras.md) e dispara a rolagem
   *  sozinho, sem o jogador precisar escolher o gatilho na mão. */
  pedidoRapido?: number;
}

/**
 * Rolador de Sanidade do jogador — diferente de Surto/Trauma, este NÃO aplica a perda
 * sozinho. `calcularPerdaSanidade` decide o valor final (metade ou cheio) a partir do
 * SUCESSO do teste de Vontade vs. DT da cena (regras.md) — mas quem julga sucesso/falha é
 * o mestre, à mão, comparando o total com a DT que tiver em mente (o app não resolve isso
 * sozinho nem no rolador do próprio mestre, ver `RoladorSanidade.tsx`). Mostra só os dados
 * brutos (d20 + perda rolada); o mestre confirma o resultado e aplica a perda na própria tela.
 */
export default function RoladorSanidadeJogador({ ficha, ready, rolar, pedidoRapido }: Props) {
  const registrarLog = useStore((s) => s.registrarLog);
  const [gatilhoId, setGatilhoId] = useState<GatilhoSanidade>('perturbador');
  const [rolando, setRolando] = useState(false);
  const [resultado, setResultado] = useState<{ d20: number; perdaRolada: number } | null>(null);

  const gatilho = PERDA_SANIDADE.find((g) => g.id === gatilhoId)!;

  const rolarSanidade = (gatilhoIdAlvo: GatilhoSanidade = gatilhoId) => {
    const gatilhoAlvo = PERDA_SANIDADE.find((g) => g.id === gatilhoIdAlvo)!;
    setRolando(true);
    const perdaTermo = parseDado(gatilhoAlvo.dado);
    rolar(
      [{ sides: 20, qty: 1 }, perdaTermo],
      (grupos) => {
        const { d20, perdaRolada } = extrairResultadosSanidade(grupos, perdaTermo);
        setResultado({ d20, perdaRolada });
        setRolando(false);
        registrarLog(
          'sanidade',
          formatarLogRolagem({
            quem: ficha.nome || 'Personagem',
            tipo: `Sanidade: ${gatilhoAlvo.nome}`,
            grupos: [{ notacao: '1d20', resultados: [d20] }, { notacao: gatilhoAlvo.dado, resultados: [perdaRolada] }],
            total: d20,
            // sem sucesso/falha ainda (só o mestre confirma, comparando com a DT) — só avisa
            // que o resultado está pendente, no mesmo tom do banner acima.
            sufixo: '· aguardando confirmação do mestre',
          }),
          ficha.id,
          'publica',
        );
      },
      'ruido',
      ficha.id,
    );
  };

  // Botão "rolar" do lembrete de Sanidade no log (LogTabJogador.tsx) — mesmo padrão de
  // `pedidoRolagem` em QuickRollOverlayJogador.tsx: incrementa de fora, `pendenteRef` espera
  // `ready` ficar true antes de disparar (a bandeja física pode não estar pronta ainda quando o
  // jogador troca de aba).
  const pendenteRef = useRef(false);
  useEffect(() => {
    if (!pedidoRapido) return;
    setGatilhoId('perturbador');
    if (ready && !rolando) rolarSanidade('perturbador');
    else pendenteRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoRapido]);

  useEffect(() => {
    if (ready && pendenteRef.current) {
      pendenteRef.current = false;
      if (!rolando) rolarSanidade('perturbador');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, rolando]);

  return (
    <section className="secao">
      <h3 className="label">Rolador de Sanidade</h3>

      <div className="campos-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div>
          <label htmlFor="rsj-gatilho">Gatilho</label>
          <select id="rsj-gatilho" value={gatilhoId} onChange={(e) => setGatilhoId(e.target.value as GatilhoSanidade)}>
            {PERDA_SANIDADE.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome} ({g.dado})
              </option>
            ))}
          </select>
        </div>
      </div>

      <button className="acento" style={{ marginTop: '0.75rem' }} disabled={!ready || rolando} onClick={() => rolarSanidade()}>
        rolar Vontade + {gatilho.dado}
      </button>

      {resultado && (
        <div className="alerta-banner mono" style={{ marginTop: '0.75rem' }}>
          <span>
            d20={resultado.d20} · rolou {resultado.perdaRolada} no dado de Sanidade — aguarde o mestre confirmar quanto perde
            de verdade
          </span>
        </div>
      )}
    </section>
  );
}
