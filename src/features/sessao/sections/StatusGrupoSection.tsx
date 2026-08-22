import { calcularPvMaximo, calcularSanidadeMaxima, calcularTierRuido } from '../../../rules/derivados';
import { personagemEstaEmSurto } from '../../../rules/surto';
import { corPv } from '../../../hooks/useIniciativa';
import { NOME_TIER_RUIDO } from '../../ruido/RuidoOverlay';
import { useStore } from '../../../state/store';
import BarraSegmentada from '../../fichas/BarraSegmentada';

const COR_TIER_RUIDO: Record<0 | 1 | 2 | 3, string> = {
  0: 'var(--ink)',
  1: 'var(--ink)',
  2: 'var(--real)',
  3: 'var(--ruido)',
};

/** Status do grupo [Privado]: leitura rápida de PV/Sanidade/Determinação/Trauma/Surto de cada
 *  ficha da mesa, sem precisar abrir a aba Personagens uma a uma. Tudo derivado — nenhum campo
 *  novo no store, mesmos cálculos de AtributosDerivadosSection.tsx. */
export default function StatusGrupoSection() {
  const fichas = useStore((s) => s.fichas);
  const basePV = useStore((s) => s.config.basePV);
  const modoCombate = useStore((s) => s.sessaoPublica.modoCombate);
  const contadorCena = useStore((s) => s.sessaoPublica.contadorCena);
  const rodada = useStore((s) => s.sessaoPublica.rodada);

  return (
    <section className="secao">
      <h3>
        status do grupo <span className="badge">privado</span>
      </h3>
      {fichas.length === 0 ? (
        <p className="vazio">nenhum personagem na mesa ainda.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          {fichas.map((ficha) => {
            const pvMaximo = calcularPvMaximo(basePV, ficha.atributos.vigor);
            const sanidadeMaxima = calcularSanidadeMaxima(ficha.atributos.vontade);
            const tierRuido = calcularTierRuido(ficha.sanidadeAtual, sanidadeMaxima);
            const traumasAtivos = ficha.traumas.filter((t) => !t.virouCicatriz).length;
            const emSurto = personagemEstaEmSurto(ficha.surtosAtivos, { modoCombate, contadorCena, rodada });

            return (
              <div key={ficha.id} className="mono" style={{ fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span
                      aria-hidden
                      style={{ background: ficha.corVisual, width: 10, height: 10, borderRadius: '50%', flexShrink: 0 }}
                    />
                    {ficha.nome || 'sem nome'}
                  </span>
                  <span style={{ display: 'flex', gap: '0.7rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span title={`Pontos de Vida: ${ficha.pvAtual} de ${pvMaximo}`}>PV {ficha.pvAtual}/{pvMaximo}</span>
                    <span
                      style={{ color: COR_TIER_RUIDO[tierRuido] }}
                      title={`Sanidade: ${ficha.sanidadeAtual} de ${sanidadeMaxima} — ${NOME_TIER_RUIDO[tierRuido]}`}
                    >
                      SAN {ficha.sanidadeAtual}/{sanidadeMaxima} · {NOME_TIER_RUIDO[tierRuido]}
                    </span>
                    <span title={`Determinação: ${ficha.determinacao} de 2`}>DET {ficha.determinacao}/2</span>
                    <span
                      style={traumasAtivos >= 3 ? { color: 'var(--ruido)' } : undefined}
                      title={`Traumas ativos: ${traumasAtivos} de 3 (no máximo — 3+ é "à beira de se perder")`}
                    >
                      TRM {traumasAtivos}/3
                    </span>
                    {emSurto && (
                      <span
                        className="badge"
                        style={{ borderColor: 'var(--ruido)', color: 'var(--ruido)' }}
                        title="surto ativo agora — efeito especial em jogo"
                      >
                        surto
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
                  <div style={{ flex: 1 }} title={`Pontos de Vida: ${ficha.pvAtual} de ${pvMaximo}`}>
                    <BarraSegmentada
                      atual={ficha.pvAtual}
                      maximo={pvMaximo}
                      variante="pv"
                      corPreenchimento={corPv(ficha.pvAtual, pvMaximo)}
                      compacta
                    />
                  </div>
                  <div
                    style={{ flex: 1 }}
                    title={`Sanidade: ${ficha.sanidadeAtual} de ${sanidadeMaxima} — ${NOME_TIER_RUIDO[tierRuido]}`}
                  >
                    <BarraSegmentada atual={ficha.sanidadeAtual} maximo={sanidadeMaxima} variante="sanidade" tier={tierRuido} compacta />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
