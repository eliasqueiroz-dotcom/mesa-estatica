import { calcularDefesa, calcularPvMaximo } from '../../rules/derivados';
import { personagemEstaEmSurto } from '../../rules/surto';
import { useStore } from '../../state/store';
import type { EntradaIniciativa, Ficha } from '../../state/types';
import CombatenteResumo from '../combate/CombatenteResumo';

interface Props {
  iniciativa: EntradaIniciativa[];
  minhaFicha: Ficha;
}

export default function CombateJogadorView({ iniciativa, minhaFicha }: Props) {
  const sessaoPublica = useStore((s) => s.sessaoPublica);
  const basePV = useStore((s) => s.config.basePV);
  const { modoCombate, indiceAtualTurno, rodada, contadorCena, condicoesCombate } = sessaoPublica;

  const ehMeuTurno = (id: string) => id === minhaFicha.id;

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
            const souEu = ehMeuTurno(e.participanteId);
            const condicoes = condicoesCombate?.[e.participanteId] ?? [];
            const pvMaximo = calcularPvMaximo(basePV, minhaFicha.atributos.vigor);
            const defesa = calcularDefesa(minhaFicha.atributos.agilidade, minhaFicha.equipamentoModificadorDefesa);
            const surtoAtivo = personagemEstaEmSurto(minhaFicha.surtosAtivos, { modoCombate, contadorCena, rodada });
            const surtoEscolha = surtoAtivo ? minhaFicha.surtosAtivos.find((s) => s.escolha !== null)?.escolha ?? null : null;
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
                <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: souEu ? '0.4rem' : 0 }}>
                  <span style={{ width: '1.2em', textAlign: 'center', color: 'var(--rede)' }}>{ativo ? '▶' : ''}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.nome || 'sem nome'}
                    {souEu && <span className="badge" style={{ marginLeft: '0.4rem' }}>você</span>}
                  </span>
                  <span className="vazio">{e.valor}</span>
                </div>
                {souEu && (
                  <CombatenteResumo
                    nome=""
                    cor={minhaFicha.corVisual}
                    pvAtual={minhaFicha.pvAtual}
                    pvMaximo={pvMaximo}
                    defesa={defesa}
                    condicoes={condicoes}
                    surtoAtivo={surtoAtivo}
                    surtoEscolha={surtoEscolha}
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
