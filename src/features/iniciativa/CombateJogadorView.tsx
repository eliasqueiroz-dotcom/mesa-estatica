import { calcularDefesa, calcularPvMaximo } from '../../rules/derivados';
import { personagemEstaEmSurto } from '../../rules/surto';
import { CONDICOES_COMBATE, nomeCondicao } from '../../rules/data/condicoesCombate';
import { useStore } from '../../state/store';
import type { EntradaIniciativa, Ficha } from '../../state/types';
import CombatenteResumo from '../combate/CombatenteResumo';

interface Props {
  iniciativa: EntradaIniciativa[];
  minhaFicha: Ficha;
  /** Quando true, omite o <section className="secao"> externo — usado dentro de CombatOverlayJogador que já tem .secao no painel. */
  semMoldura?: boolean;
  /** Mapa participanteId → corVisual, usado pra mostrar bolinha colorida antes do nome. Opcional — omitido no uso standalone (NPCs tab). */
  corMap?: Record<string, string>;
}

export default function CombateJogadorView({ iniciativa, minhaFicha, semMoldura, corMap }: Props) {
  const sessaoPublica = useStore((s) => s.sessaoPublica);
  const basePV = useStore((s) => s.config.basePV);
  const ajustarPvAtual = useStore((s) => s.ajustarPvAtual);
  const atualizarFicha = useStore((s) => s.atualizarFicha);
  const alternarCondicaoCombate = useStore((s) => s.alternarCondicaoCombate);
  const { modoCombate, indiceAtualTurno, rodada, contadorCena, condicoesCombate } = sessaoPublica;

  const ehMeuTurno = (id: string) => id === minhaFicha.id;
  const minhaVez = modoCombate && iniciativa[indiceAtualTurno]?.participanteId === minhaFicha.id;

  const conteudo = !modoCombate ? (
    semMoldura ? (
      <p className="vazio">fora de combate.</p>
    ) : (
      <>
        <h3 className="label" style={{ marginBottom: '0.3rem' }}>Combate</h3>
        <p className="vazio">fora de combate.</p>
      </>
    )
  ) : (
    <>
      {!semMoldura && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <h3 className="label" style={{ margin: 0 }}>
            Combate
          </h3>
          <span className="vazio mono">rodada {rodada}</span>
        </div>
      )}

      {minhaVez && (
        <div
          className="mono"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem',
            padding: '0.4rem 0.6rem', border: '1px solid var(--rede)', background: 'var(--rede-glow)',
            color: 'var(--rede)', fontSize: 12, fontWeight: 600,
          }}
        >
          ▶ sua vez
        </div>
      )}

      {iniciativa.length === 0 ? (
        <p className="vazio">aguardando o mestre rolar iniciativa.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {iniciativa.map((e, i) => {
            const ativo = i === indiceAtualTurno;
            const souEu = ehMeuTurno(e.participanteId);
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
                  <span
                    style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: corMap?.[e.participanteId] ?? '#666',
                      display: 'inline-block', flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.nome || 'sem nome'}
                    {souEu && <span className="badge" style={{ marginLeft: '0.4rem' }}>você</span>}
                  </span>
                </div>
                {souEu && (
                  <div style={{ paddingLeft: '1.1rem' }}>
                    {minhaFicha.armas.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                        {minhaFicha.armas.map((a) => (
                          <span
                            key={a.id}
                            className="badge"
                            style={{ alignSelf: 'flex-start', fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                            title={`${a.nome || 'arma'} · bonus: ${a.bonusAtaque} · dano: ${a.dano} · alcance: ${a.alcance}${a.nota ? ` · ${a.nota}` : ''}`}
                          >
                            🗡 {a.nome || 'arma'}
                          </span>
                        ))}
                      </div>
                    )}
                    <CombatenteResumo
                      nome=""
                      cor={minhaFicha.corVisual}
                      pvAtual={minhaFicha.pvAtual}
                      pvMaximo={pvMaximo}
                      defesa={defesa}
                      surtoAtivo={surtoAtivo}
                      surtoEscolha={surtoEscolha}
                      editavel
                      hideDot
                      onAjustarPv={(d) => ajustarPvAtual(minhaFicha.id, minhaFicha.pvAtual + d)}
                    />
                    <div className="combate-condicoes" style={{ marginTop: '0.5rem' }}>
                      {CONDICOES_COMBATE.map((c) => {
                        const ligada = condicoesCombate?.[minhaFicha.id]?.includes(c.id) ?? false;
                        return (
                          <button
                            key={c.id}
                            className={`combate-chip${ligada ? ' combate-chip--ativa' : ''}`}
                            title={c.efeito}
                            onClick={() => alternarCondicaoCombate(minhaFicha.id, c.id)}
                          >
                            {nomeCondicao(c.id)}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                      <span className="vazio" style={{ fontSize: 10, color: 'var(--real)' }}>🛡</span>
                      <button className="icone-botao" onClick={() => atualizarFicha(minhaFicha.id, { equipamentoModificadorDefesa: (minhaFicha.equipamentoModificadorDefesa ?? 0) - 1 })} style={{ fontSize: 10, padding: '0.1em 0.35em' }}>−</button>
                      <span className="mono" style={{ fontSize: 11, minWidth: 20, textAlign: 'center' }}>{defesa}</span>
                      <button className="icone-botao" onClick={() => atualizarFicha(minhaFicha.id, { equipamentoModificadorDefesa: (minhaFicha.equipamentoModificadorDefesa ?? 0) + 1 })} style={{ fontSize: 10, padding: '0.1em 0.35em' }}>+</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  if (semMoldura) return conteudo;
  return <section className="secao">{conteudo}</section>;
}
