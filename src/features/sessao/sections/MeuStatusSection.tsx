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

/** Card compacto do próprio status pro jogador: PV/Sanidade/Determinação/Trauma/Surto da
 *  PRÓPRIA ficha, sem trocar pra aba Personagens. `s.fichas` no bundle do jogador só contém a
 *  própria ficha (useMinhaFicha) — sem risco de expor dados de outros PCs. `SessaoPublicaView`
 *  é montada sempre, mesmo sem ficha vinculada ainda, então este componente se defende sozinho. */
export default function MeuStatusSection() {
  const fichaAtivaId = useStore((s) => s.fichaAtivaId);
  const ficha = useStore((s) => s.fichas.find((f) => f.id === s.fichaAtivaId) ?? null);
  const basePV = useStore((s) => s.config.basePV);
  const modoCombate = useStore((s) => s.sessaoPublica.modoCombate);
  const contadorCena = useStore((s) => s.sessaoPublica.contadorCena);
  const rodada = useStore((s) => s.sessaoPublica.rodada);

  if (!fichaAtivaId || !ficha) return null;

  const pvMaximo = calcularPvMaximo(basePV, ficha.atributos.vigor);
  const sanidadeMaxima = calcularSanidadeMaxima(ficha.atributos.vontade);
  const tierRuido = calcularTierRuido(ficha.sanidadeAtual, sanidadeMaxima);
  const traumasAtivos = ficha.traumas.filter((t) => !t.virouCicatriz).length;
  const emSurto = personagemEstaEmSurto(ficha.surtosAtivos, { modoCombate, contadorCena, rodada });

  return (
    <section className="secao">
      <h3>meu status</h3>
      <div className="mono" style={{ fontSize: '13px' }}>
        <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center', flexWrap: 'wrap' }}>
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
    </section>
  );
}
