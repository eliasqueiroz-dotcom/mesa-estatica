import { useDiceBox } from '../../dice/useDiceBox';
import { resolverRolagemJogador } from '../../multiplayer/rolagemRemota';
import type { Ficha } from '../../state/types';
import RoladorTesteJogador from './RoladorTesteJogador';

interface Props {
  ficha: Ficha;
  active?: boolean;
}

/**
 * Aba de dados do jogador (Fase 6, mesa-estatica-multiplayer-completo.md §6.5) — mesma
 * bandeja física de `DadosTab.tsx`, mas `useDiceBox` recebe `resolverRolagemJogador` em vez
 * do padrão do mestre: sempre tenta `resolver-rolagem` (sem o gate de
 * `VITE_FASE_D_ROLAGEM_REMOTA`, que só existe pra validação incremental do mestre). Só o
 * rolador de teste da própria ficha — sem Sanidade/Surto/Trauma/rolagem livre, que são
 * fluxos do mestre.
 */
export default function DadosTabJogador({ ficha, active = true }: Props) {
  const { ready, rolando, erro, modo2D, rolar } = useDiceBox('dice-bandeja-jogador', active, 100, resolverRolagemJogador);
  const podeRolar = ready && !rolando;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', alignItems: 'start' }}>
      {!modo2D && (
        <div
          id="dice-bandeja-jogador"
          style={{
            gridColumn: '1 / -1',
            width: '100%',
            height: '280px',
            background: 'var(--concrete-0)',
            border: '1px solid var(--concrete-2)',
          }}
        />
      )}
      {modo2D && (
        <div className="secao" style={{ gridColumn: '1 / -1' }}>
          <p className="vazio">
            renderização 3D indisponível neste aparelho (sem WebGL) — os dados ainda funcionam, só sem o visual físico.
          </p>
        </div>
      )}
      {erro && !modo2D && <p style={{ color: 'var(--ruido)' }}>erro: {erro}</p>}
      {!ready && !erro && <p className="vazio">carregando física dos dados…</p>}

      <RoladorTesteJogador ficha={ficha} ready={podeRolar} rolar={rolar} />
    </div>
  );
}
