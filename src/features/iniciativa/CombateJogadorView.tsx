import { nomeCondicao } from '../../rules/data/condicoesCombate';
import { useStore } from '../../state/store';
import type { EntradaIniciativa } from '../../state/types';

interface Props {
  iniciativa: EntradaIniciativa[];
  minhaFichaId: string;
}

/**
 * Visão de combate do jogador (mesa-estatica-multiplayer-completo.md Parte IV §5, "Mapas:
 * read-only no resto") — só leitura, por construção: sem rolar/reordenar iniciativa, sem
 * avançar turno, sem editar condição. `IniciativaPanel.tsx` (mestre) não foi reaproveitado
 * de propósito — ele expõe drag-and-drop, steppers de PV/Defesa e ações de NPC sem nenhum
 * gate além de `podeArrastar` (só trava o drag), então não dá pra simplesmente montá-lo aqui.
 * Ordem de turno vem de `iniciativa` (nova tabela, migração 0006 — antes só vivia no store
 * local do GM); `modoCombate`/`indiceAtualTurno`/`rodada`/`condicoesCombate` já vinham
 * sincronizados via `sessaoPublica` desde a Fase de hidratação anterior.
 */
export default function CombateJogadorView({ iniciativa, minhaFichaId }: Props) {
  const sessaoPublica = useStore((s) => s.sessaoPublica);
  const { modoCombate, indiceAtualTurno, rodada, condicoesCombate } = sessaoPublica;

  if (!modoCombate) {
    return (
      <section className="secao">
        <h3 className="label">Combate</h3>
        <p className="vazio">fora de combate.</p>
      </section>
    );
  }

  return (
    <section className="secao">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
        <h3 className="label" style={{ margin: 0 }}>
          Combate
        </h3>
        <span className="vazio mono">rodada {rodada}</span>
      </div>

      {iniciativa.length === 0 ? (
        <p className="vazio">aguardando o mestre rolar iniciativa.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {iniciativa.map((e, i) => {
            const ativo = i === indiceAtualTurno;
            const souEu = e.tipo === 'pc' && e.participanteId === minhaFichaId;
            const condicoes = condicoesCombate?.[e.participanteId] ?? [];
            return (
              <div
                key={e.id}
                className="mono"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.4rem 0.6rem',
                  border: '1px solid var(--concrete-2)',
                  borderColor: ativo ? 'var(--rede)' : 'var(--concrete-2)',
                  background: ativo ? 'var(--rede-glow)' : undefined,
                }}
              >
                <span style={{ width: '1.2em', textAlign: 'center', color: 'var(--rede)' }}>{ativo ? '▶' : ''}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.nome || 'sem nome'}
                  {souEu && <span className="badge" style={{ marginLeft: '0.4rem' }}>você</span>}
                </span>
                <span className="vazio">{e.valor}</span>
                {condicoes.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    {condicoes.map((c) => (
                      <span key={c} className="badge" title={c} style={{ fontSize: 10 }}>
                        {nomeCondicao(c)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
