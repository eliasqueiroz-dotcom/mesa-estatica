import { useState } from 'react';
import { usePedidoRolagemDanoStore } from '../../state/pedidoRolagemDanoStore';
import type { Ficha } from '../../state/types';
import { IconeLamina } from './icones';

interface Props {
  ficha: Ficha;
  /** true só quando `IniciativaPanel.tsx` (mestre) monta este componente — controla se o dano
   *  nasce privado por padrão, com checkbox. Ausente (jogador, `CombateJogadorView.tsx`) =
   *  sempre público, sem checkbox — comportamento inalterado. */
  souMestre?: boolean;
}

/**
 * Chips de arma da aba Combate — clique pede a rolagem de dano via `pedidoRolagemDanoStore`
 * (`QuickRollOverlay.tsx`/`QuickRollOverlayJogador.tsx` são quem de fato rolam o dado e chamam
 * `rolarDanoArmaFicha`, na bandeja física que já têm, lendo `registrarLog`/`registrarRoll` do
 * próprio `useStore` — não precisam vir por prop). Este componente não guarda mais sua própria
 * instância de `useDiceBox` — antes tinha uma caixinha 40×40 própria por card de PC expandido,
 * frágil a colisão entre instâncias simultâneas (achado ao vivo no commit `20fe51d`) e sem
 * espaço de verdade pro dado 3D cair.
 */
export default function ArmasCombate({ ficha, souMestre }: Props) {
  // "crít." é flag de "próxima rolagem" por arma, mesmo padrão de `ArmasSection.tsx` — desarma
  // sozinho depois de usado.
  const [critico, setCritico] = useState<Record<string, boolean>>({});
  const [privado, setPrivado] = useState(true);
  const pedido = usePedidoRolagemDanoStore((s) => s.pedido);
  const pedirRolagemDano = usePedidoRolagemDanoStore((s) => s.pedirRolagemDano);
  const visibilidade = souMestre && privado ? 'privada' : 'publica';

  if (ficha.armas.length === 0) return null;

  const rolarDano = (armaId: string) => {
    const ehCritico = critico[armaId] ?? false;
    setCritico((prev) => ({ ...prev, [armaId]: false }));
    pedirRolagemDano({ id: crypto.randomUUID(), fichaId: ficha.id, armaId, critico: ehCritico, visibilidade });
  };

  return (
    <div style={{ marginBottom: '0.4rem' }}>
      <span className="combate-rotulo">armas</span>
      {souMestre && (
        <label
          title="dano rolado aqui nasce privado por padrão — desmarque pra rolar público"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: 10, cursor: 'pointer', color: 'var(--ink-faint)', marginLeft: '0.4rem' }}
        >
          <input type="checkbox" checked={privado} onChange={(e) => setPrivado(e.target.checked)} />
          privado
        </label>
      )}
      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {ficha.armas.map((a) => (
          <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
            <button
              className="combate-chip combate-chip--ativa"
              disabled={pedido !== null}
              onClick={() => rolarDano(a.id)}
              title={`${a.nome || 'arma'} · bonus: ${a.bonusAtaque} · dano: ${a.dano} · alcance: ${a.alcance}${a.nota ? ` · ${a.nota}` : ''}`}
              style={{ fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <IconeLamina size={10} /> {a.nome || 'arma'}
            </button>
            <label title="margem 10+ ou 20 natural — usa o máximo do dado" style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', fontSize: 10, cursor: 'pointer', color: 'var(--ink-faint)' }}>
              <input
                type="checkbox"
                checked={critico[a.id] ?? false}
                onChange={(e) => setCritico((prev) => ({ ...prev, [a.id]: e.target.checked }))}
              />
              crít.
            </label>
          </span>
        ))}
      </div>
    </div>
  );
}
