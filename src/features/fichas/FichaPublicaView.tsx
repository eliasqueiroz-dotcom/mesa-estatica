import { estaFerido } from '../../rules/derivados';
import { personagemEstaEmSurto } from '../../rules/surto';
import { descricaoSurto } from '../../rules/data/surto';
import { useStore } from '../../state/store';
import BarraSegmentada from './BarraSegmentada';
import type { FichaPublica } from '../../multiplayer/fichaSplit';
import './ficha.css';

interface Props {
  ficha: FichaPublica;
}

/**
 * Superfície de mesa de um PC (mesa-estatica-multiplayer-completo.md Parte IV §3) — o
 * que qualquer participante vê de um personagem que não é o seu: nome, cor, PV, estado
 * (ferido/surto). Nunca sanidade, dinheiro, perícias, traumas, história — isso vive em
 * `characters_privado` (Fase B), só o dono e o mestre.
 *
 * Só leitura, de propósito — sem inputs, sem ações do store. A própria ficha do jogador
 * continua usando o `FichaEditor` completo (editável); esta view é só pra fichas alheias.
 */
export default function FichaPublicaView({ ficha }: Props) {
  const modoCombate = useStore((s) => s.sessaoPublica.modoCombate);
  const contadorCena = useStore((s) => s.sessaoPublica.contadorCena);
  const rodada = useStore((s) => s.sessaoPublica.rodada);

  const ferido = estaFerido(ficha.pvAtual, ficha.pvMaximo);
  const surtoAtivoAgora = personagemEstaEmSurto(ficha.surtosAtivos, { modoCombate, contadorCena, rodada });
  const surtosVisiveis = ficha.surtosAtivos.filter((s) => (modoCombate ? s.expiraEm >= rodada : s.expiraEm === contadorCena));

  return (
    <section className="secao ficha-publica-view">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
        <span
          aria-hidden
          style={{ background: ficha.corVisual, width: 14, height: 14, borderRadius: '50%', display: 'inline-block', flexShrink: 0 }}
        />
        <h3 className="label" style={{ margin: 0 }}>
          {ficha.nome || 'sem nome'}
        </h3>
      </div>

      <div className="derivado-card" data-ferido={ferido}>
        <div className="derivado-card__label">PV</div>
        <div className="derivado-card__valor">{ficha.pvMaximo}</div>
        <div className="derivado-card__atual">
          <span className="vazio">atual</span>
          <span className="mono">{ficha.pvAtual}</span>
        </div>
        <BarraSegmentada atual={ficha.pvAtual} maximo={ficha.pvMaximo} variante="pv" />
        {ferido && (
          <span className="badge" style={{ marginTop: '0.4rem' }}>
            ferido
          </span>
        )}
      </div>

      {surtoAtivoAgora && surtosVisiveis.length > 0 && (
        <div className="badges-linha" style={{ marginTop: '0.6rem' }}>
          {surtosVisiveis.map((s) => (
            <span
              key={s.id}
              className="badge"
              style={{ borderColor: 'var(--ruido)', color: 'var(--ruido)' }}
              title={s.escolha ? descricaoSurto(s.escolha) : undefined}
            >
              surto{s.escolha ? `: ${s.escolha}` : ' ativo'}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
