import { useState } from 'react';
import { useStore } from '../../../state/store';
import type { SecaoFichaProps } from '../tipos';

const INCREMENTOS = [1, 10, 100];

export default function DinheiroSection({ ficha }: SecaoFichaProps) {
  const ajustarDinheiro = useStore((s) => s.ajustarDinheiro);
  const converterDinheiro = useStore((s) => s.converterDinheiro);

  const [direcao, setDirecao] = useState<'pontoParaReal' | 'realParaPonto'>('pontoParaReal');
  const [valorTexto, setValorTexto] = useState('');

  const valor = Math.max(0, Math.floor(Number(valorTexto) || 0));
  const saldoOrigem = direcao === 'pontoParaReal' ? ficha.dinheiroPonto : ficha.dinheiroReal;
  const debitado = Math.min(valor, saldoOrigem);
  // espelha exatamente converterDinheiro (store.ts) — Math.max(1, Math.round(...)), não floor,
  // senão a prévia diverge do valor realmente creditado (ex: P$1 mostrava "R$0", creditava R$1).
  const creditado = direcao === 'pontoParaReal' ? (debitado === 0 ? 0 : Math.max(1, Math.round(debitado * 0.7))) : debitado;

  const converter = () => {
    if (debitado === 0) return;
    converterDinheiro(ficha.id, direcao, debitado);
    setValorTexto('');
  };

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

      <div className="secao" style={{ marginTop: '0.75rem', background: 'var(--concrete-0)' }}>
        <div className="label" style={{ fontSize: '12px', marginBottom: '0.5rem' }}>
          câmbio
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={direcao} onChange={(e) => setDirecao(e.target.value as typeof direcao)} style={{ width: 'auto' }}>
            <option value="pontoParaReal">P$ → R$ (cambista, -30%)</option>
            <option value="realParaPonto">R$ → P$ (justificar origem)</option>
          </select>
          <input
            type="number"
            min={0}
            placeholder="valor"
            value={valorTexto}
            onChange={(e) => setValorTexto(e.target.value)}
            style={{ width: '100px' }}
          />
          <button className="acento" onClick={converter} disabled={debitado === 0}>
            converter
          </button>
        </div>

        {valor > 0 && (
          <p className="vazio mono" style={{ marginTop: '0.5rem' }}>
            {debitado < valor && `saldo insuficiente — convertendo o máximo disponível: `}
            {direcao === 'pontoParaReal'
              ? `P$ ${debitado} → R$ ${creditado}`
              : `R$ ${debitado} → P$ ${creditado}`}
          </p>
        )}
        {direcao === 'realParaPonto' && (
          <p className="vazio" style={{ marginTop: '0.3rem' }}>
            justificar origem — o mestre decide se permite. a conversão acontece de qualquer forma; desfaça pelo histórico se não aprovar.
          </p>
        )}
      </div>

      <p className="vazio" style={{ marginTop: '0.5rem' }}>
        câmbio: P$ → R$ com cambista custa 30% (a taxa do sigilo)
      </p>
    </section>
  );
}
