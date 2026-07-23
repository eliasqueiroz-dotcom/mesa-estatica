import { estaFerido } from '../../rules/derivados';
import type { Npc } from '../../state/types';
import BarraSegmentada from '../fichas/BarraSegmentada';

interface Props {
  npc: Npc;
}

/**
 * Superfície de mesa de um NPC (mesa-estatica-multiplayer-completo.md Parte IV §3) — o
 * que um participante vê de um NPC revelado: nome, cor, PV, Defesa, Agilidade, categoria,
 * notas gerais e as ações (só a lista — rolar por ele continua exclusivo do mestre, ver
 * `usarAcaoNpc` em rules/npcAcoes.ts). Nunca `notasMestre`.
 *
 * Recusa renderizar (retorna null) se `visivel` for falso — checagem redundante à futura
 * RLS da Fase F (§11), mas essa camada de UI não deve depender só do caller filtrar certo.
 * Read-only: sem inputs, sem ações do store, chips de ação não são clicáveis.
 */
export default function NpcPublicaView({ npc }: Props) {
  if (!npc.visivel) return null;

  const ferido = estaFerido(npc.pvAtual, npc.pvMaximo);

  return (
    <section className="secao npc-publica-view">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
        <span
          aria-hidden
          style={{ background: npc.corVisual, width: 14, height: 14, borderRadius: '50%', display: 'inline-block', flexShrink: 0 }}
        />
        <h3 className="label" style={{ margin: 0 }}>
          {npc.nome || 'sem nome'}
        </h3>
        {npc.categoria && <span className="badge">{npc.categoria}</span>}
      </div>

      <div className="derivados-grid">
        <div className="derivado-card" data-ferido={ferido}>
          <div className="derivado-card__label">PV</div>
          <div className="derivado-card__valor">{npc.pvMaximo}</div>
          <div className="derivado-card__atual">
            <span className="vazio">atual</span>
            <span className="mono">{npc.pvAtual}</span>
          </div>
          <BarraSegmentada atual={npc.pvAtual} maximo={npc.pvMaximo} variante="pv" />
          {ferido && (
            <span className="badge" style={{ marginTop: '0.4rem' }}>
              ferido
            </span>
          )}
        </div>

        <div className="derivado-card">
          <div className="derivado-card__label">Defesa</div>
          <div className="derivado-card__valor">{npc.defesa}</div>
        </div>

        <div className="derivado-card">
          <div className="derivado-card__label">Agilidade</div>
          <div className="derivado-card__valor">{npc.agilidade}</div>
        </div>
      </div>

      {npc.notas && (
        <p className="vazio" style={{ marginTop: '0.6rem' }}>
          {npc.notas}
        </p>
      )}

      {npc.acoes.length > 0 && (
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
          {npc.acoes.map((a) => (
            <span
              key={a.id}
              className="combate-chip"
              title={a.dano ? `dano ${a.dano}` : undefined}
              style={{ fontSize: 11 }}
            >
              🗡 {a.nome} ({a.bonus >= 0 ? '+' : ''}
              {a.bonus})
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
