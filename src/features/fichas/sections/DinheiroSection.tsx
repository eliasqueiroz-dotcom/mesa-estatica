import { useStore } from '../../../state/store';
import type { SecaoFichaProps } from '../tipos';

const INCREMENTOS = [1, 10, 100];

export default function DinheiroSection({ ficha }: SecaoFichaProps) {
  const ajustarDinheiro = useStore((s) => s.ajustarDinheiro);

  return (
    <section className="secao">
      <h3 className="label">Dinheiro</h3>
      <div className="dinheiro-grid">
        <div className="dinheiro-card dinheiro-card--real">
          <div className="label">R$ — papel, a rua</div>
          <div className="dinheiro-card__valor">R$ {ficha.dinheiroReal}</div>
          <div className="dinheiro-botoes">
            {INCREMENTOS.map((n) => (
              <button key={`real-menos-${n}`} onClick={() => ajustarDinheiro(ficha.id, 'real', ficha.dinheiroReal - n)}>
                -{n}
              </button>
            ))}
            {INCREMENTOS.map((n) => (
              <button key={`real-mais-${n}`} onClick={() => ajustarDinheiro(ficha.id, 'real', ficha.dinheiroReal + n)}>
                +{n}
              </button>
            ))}
          </div>
        </div>
        <div className="dinheiro-card dinheiro-card--ponto">
          <div className="label">P$ — Ponto®, a rede, rastreada</div>
          <div className="dinheiro-card__valor">P$ {ficha.dinheiroPonto}</div>
          <div className="dinheiro-botoes">
            {INCREMENTOS.map((n) => (
              <button key={`ponto-menos-${n}`} onClick={() => ajustarDinheiro(ficha.id, 'ponto', ficha.dinheiroPonto - n)}>
                -{n}
              </button>
            ))}
            {INCREMENTOS.map((n) => (
              <button key={`ponto-mais-${n}`} onClick={() => ajustarDinheiro(ficha.id, 'ponto', ficha.dinheiroPonto + n)}>
                +{n}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="vazio" style={{ marginTop: '0.5rem' }}>
        câmbio: P$ → R$ com cambista custa 30% (a taxa do sigilo)
      </p>
    </section>
  );
}
