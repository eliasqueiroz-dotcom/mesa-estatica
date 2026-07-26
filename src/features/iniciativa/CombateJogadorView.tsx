import type { FichaPublica } from '../../multiplayer/fichaSplit';
import { calcularDefesa, calcularPvMaximo } from '../../rules/derivados';
import { personagemEstaEmSurto } from '../../rules/surto';
import { useStore } from '../../state/store';
import type { EntradaIniciativa, Ficha, Npc } from '../../state/types';
import CombatenteResumo from '../combate/CombatenteResumo';

interface Props {
  iniciativa: EntradaIniciativa[];
  minhaFicha: Ficha;
  outrasFichas: FichaPublica[];
  npcs: Omit<Npc, 'notasMestre'>[];
}

/**
 * Visão de combate do jogador (mesa-estatica-multiplayer-completo.md Parte IV §5, "Mapas:
 * read-only no resto") — só leitura, por construção: sem rolar/reordenar iniciativa, sem
 * avançar turno, sem editar condição. `IniciativaPanel.tsx` (mestre) não foi reaproveitado
 * de propósito — ele expõe drag-and-drop, steppers de PV/Defesa e ações de NPC sem nenhum
 * gate além de `podeArrastar` (só trava o drag), então não dá pra simplesmente montá-lo aqui.
 * Ordem de turno vem de `iniciativa` (nova tabela, migração 0006 — antes só vivia no store
 * local do GM); `modoCombate`/`indiceAtualTurno`/`rodada`/`condicoesCombate` já vinham
 * sincronizados via `sessaoPublica` desde a Fase de hidratação anterior. PV/Defesa por linha
 * (Parte IV §4) — próprio PC usa `minhaFicha` (dados privados completos), PC alheio usa
 * `FichaPublica` (que já ganhou `defesa` — antes só NPC tinha isso público), NPC já era
 * 100% público. Sempre `<CombatenteResumo editavel={false} .../>`.
 */
export default function CombateJogadorView({ iniciativa, minhaFicha, outrasFichas, npcs }: Props) {
  const sessaoPublica = useStore((s) => s.sessaoPublica);
  const basePV = useStore((s) => s.config.basePV);
  const { modoCombate, indiceAtualTurno, rodada, contadorCena, condicoesCombate } = sessaoPublica;

  const resumoDoParticipante = (id: string) => {
    if (id === minhaFicha.id) {
      const pvMaximo = calcularPvMaximo(basePV, minhaFicha.atributos.vigor);
      const defesa = calcularDefesa(minhaFicha.atributos.agilidade, minhaFicha.equipamentoModificadorDefesa);
      const surtoAtivo = personagemEstaEmSurto(minhaFicha.surtosAtivos, { modoCombate, contadorCena, rodada });
      const surtoEscolha = surtoAtivo ? minhaFicha.surtosAtivos.find((s) => s.escolha !== null)?.escolha ?? null : null;
      return { cor: minhaFicha.corVisual, pvAtual: minhaFicha.pvAtual, pvMaximo, defesa, surtoAtivo, surtoEscolha };
    }
    const ficha = outrasFichas.find((f) => f.id === id);
    if (ficha) {
      const surtoAtivo = personagemEstaEmSurto(ficha.surtosAtivos, { modoCombate, contadorCena, rodada });
      const surtoEscolha = surtoAtivo ? ficha.surtosAtivos.find((s) => s.escolha !== null)?.escolha ?? null : null;
      return { cor: ficha.corVisual, pvAtual: ficha.pvAtual, pvMaximo: ficha.pvMaximo, defesa: ficha.defesa, surtoAtivo, surtoEscolha };
    }
    const npc = npcs.find((n) => n.id === id);
    if (npc) return { cor: npc.corVisual, pvAtual: npc.pvAtual, pvMaximo: npc.pvMaximo, defesa: npc.defesa, surtoAtivo: false, surtoEscolha: null };
    return null;
  };

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
            const souEu = e.tipo === 'pc' && e.participanteId === minhaFicha.id;
            const condicoes = condicoesCombate?.[e.participanteId] ?? [];
            const resumo = resumoDoParticipante(e.participanteId);
            return (
              <div
                key={e.id}
                style={{
                  padding: '0.4rem 0.6rem',
                  border: '1px solid var(--concrete-2)',
                  borderColor: ativo ? 'var(--rede)' : 'var(--concrete-2)',
                  background: ativo ? 'var(--rede-glow)' : undefined,
                }}
              >
                <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: resumo ? '0.4rem' : 0 }}>
                  <span style={{ width: '1.2em', textAlign: 'center', color: 'var(--rede)' }}>{ativo ? '▶' : ''}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.nome || 'sem nome'}
                    {souEu && <span className="badge" style={{ marginLeft: '0.4rem' }}>você</span>}
                  </span>
                  <span className="vazio">{e.valor}</span>
                </div>
                {resumo && (
                  <CombatenteResumo
                    nome=""
                    cor={resumo.cor}
                    pvAtual={resumo.pvAtual}
                    pvMaximo={resumo.pvMaximo}
                    defesa={resumo.defesa}
                    condicoes={condicoes}
                    surtoAtivo={resumo.surtoAtivo}
                    surtoEscolha={resumo.surtoEscolha}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
