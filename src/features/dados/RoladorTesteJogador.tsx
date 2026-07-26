import { useState } from 'react';
import type { ColorsetId } from '../../dice/colorsets';
import type { RollGroupResult } from '../../dice/useDiceBox';
import { calcularPvMaximo, estaFerido } from '../../rules/derivados';
import { ATRIBUTOS, PERICIAS } from '../../rules/data/pericias';
import { useStore } from '../../state/store';
import type { Ficha } from '../../state/types';

interface Props {
  ficha: Ficha;
  ready: boolean;
  rolar: (
    notacao: string,
    onComplete: (r: RollGroupResult[]) => void,
    colorset?: ColorsetId,
    personagemId?: string | null,
  ) => void;
}

/**
 * Rolador de teste do jogador (mesa-estatica-multiplayer-completo.md Parte IV §6.5, Fase 6) —
 * versão reduzida de `RoladorTeste.tsx`: só a própria ficha (sem seletor PC/NPC), e sem
 * sucesso/falha/margem — a DT da cena mora em `sessaoPrivada`, que nunca chega no bundle do
 * jogador. Mostra só d20 + modificador = total; o mestre narra o resultado.
 */
export default function RoladorTesteJogador({ ficha, ready, rolar }: Props) {
  const basePV = useStore((s) => s.config.basePV);
  const registrarLog = useStore((s) => s.registrarLog);
  const registrarRoll = useStore((s) => s.registrarRoll);

  const [periciaId, setPericiaId] = useState(PERICIAS[0].id);
  const [resultado, setResultado] = useState<{ d20: number; modificador: number; total: number } | null>(null);
  const [rolando, setRolando] = useState(false);

  const pericia = PERICIAS.find((p) => p.id === periciaId)!;
  const atributo = ATRIBUTOS.find((a) => a.id === pericia.atributo)!;

  const podeRolar = ready && !rolando;

  const rolarTeste = () => {
    setRolando(true);
    rolar(
      '1d20',
      (grupos) => {
        const d20 = grupos[0]?.rolls[0]?.value ?? 0;
        const pvMaximo = calcularPvMaximo(basePV, ficha.atributos.vigor);
        const ferido = estaFerido(ficha.pvAtual, pvMaximo);
        const penalidadeFerido = ferido && (pericia.atributo === 'vigor' || pericia.atributo === 'agilidade') ? -2 : 0;
        const grauPericia = ficha.pericias[periciaId] ?? 0;
        const modificador = ficha.atributos[pericia.atributo] + grauPericia + penalidadeFerido;
        setResultado({ d20, modificador, total: d20 + modificador });
        setRolando(false);

        const nome = ficha.nome || 'Personagem';
        const modStr = modificador >= 0 ? `+${modificador}` : `${modificador}`;
        registrarLog('teste', `${nome} · ${atributo.nome}+${pericia.nome} → d20${modStr} = ${d20 + modificador}`, ficha.id, 'publica');
        registrarRoll({
          origem: nome,
          personagemId: ficha.id,
          formula: `d20${modStr}`,
          total: d20 + modificador,
          bruto: d20,
          visibilidade: 'publica',
        });
      },
      'rede',
      ficha.id,
    );
  };

  return (
    <section className="secao">
      <h3 className="label">Rolar teste</h3>

      <div className="campos-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div>
          <label htmlFor="rtj-pericia">Perícia</label>
          <select id="rtj-pericia" value={periciaId} onChange={(e) => setPericiaId(e.target.value)}>
            {PERICIAS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} ({ATRIBUTOS.find((a) => a.id === p.atributo)!.nome})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
        <button className="acento" disabled={!podeRolar} onClick={rolarTeste}>
          rolar {atributo.nome.toLowerCase()}+{pericia.nome.toLowerCase()}
        </button>
      </div>

      {resultado && (
        <div className="alerta-banner mono" style={{ marginTop: '0.75rem' }}>
          <span>
            d20={resultado.d20} {resultado.modificador >= 0 ? '+' : ''}
            {resultado.modificador} = {resultado.total}
          </span>
        </div>
      )}
    </section>
  );
}
