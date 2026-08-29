import { useState } from 'react';
import { ATRIBUTOS, PERICIAS, type DefinicaoPericia, type GrauPericia } from '../../../rules/data/pericias';
import { usePedidoRolagemTesteStore } from '../../../state/pedidoRolagemTesteStore';
import type { SecaoFichaProps } from '../tipos';

const GRAUS: { valor: GrauPericia; label: string }[] = [
  { valor: 0, label: '—' },
  { valor: 3, label: 'T' },
  { valor: 6, label: 'V' },
];

/** Cada linha tem um botão de rolagem (d20 + atributo + grau, com Ferido aplicado) — de propósito,
 *  sem sucesso/falha contra a DT da cena — só o total, igual RoladorTesteJogador.tsx; o mestre
 *  narra o resultado. A rolagem em si acontece na bandeja física do `QuickRollOverlay`/
 *  `QuickRollOverlayJogador` (pedida via `pedidoRolagemTesteStore`, mesma ponte que
 *  `ArmasCombate.tsx` usa pro dano/ataque de arma) — abre o "d20 rápido" sozinho e anima no
 *  header de todo mundo, exceto rolagem privada do mestre (ver `rolarTestePericiaFicha`). */
export default function PericiasSection({ ficha, onChange, souMestre }: SecaoFichaProps) {
  const pedido = usePedidoRolagemTesteStore((s) => s.pedido);
  const pedirRolagemTeste = usePedidoRolagemTesteStore((s) => s.pedirRolagemTeste);
  const [privado, setPrivado] = useState(true);
  const visibilidade = souMestre && privado ? 'privada' : 'publica';

  const definirGrau = (periciaId: string, grau: GrauPericia) => {
    onChange({ pericias: { ...ficha.pericias, [periciaId]: grau } });
  };

  const rolarPericia = (p: DefinicaoPericia) => {
    pedirRolagemTeste({ id: crypto.randomUUID(), fichaId: ficha.id, periciaId: p.id, visibilidade });
  };

  return (
    <section className="secao">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <h3 className="label" style={{ margin: 0 }}>Perícias</h3>
        <span className="vazio" style={{ fontSize: 10 }}>— · T=treinado · V=veterano</span>
        {souMestre && (
          <label
            title="teste de perícia rolado aqui nasce privado por padrão — desmarque pra rolar público"
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '11px', cursor: 'pointer' }}
          >
            <input type="checkbox" checked={privado} onChange={(e) => setPrivado(e.target.checked)} />
            privado
          </label>
        )}
      </div>
      <div className="pericias-grid">
        {ATRIBUTOS.map((atributo) => {
          const daColuna = PERICIAS.filter((p) => p.atributo === atributo.id);
          if (daColuna.length === 0) return null;
          return (
            <div key={atributo.id} className="pericias-coluna">
              <h4>{atributo.nome}</h4>
              {daColuna.map((p) => {
                const grauAtual = ficha.pericias[p.id] ?? 0;
                return (
                  <div key={p.id} className="pericia-linha">
                    <span className="pericia-linha__nome">{p.nome}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button
                        className="icone-botao"
                        title={`rolar ${atributo.nome}+${p.nome}`}
                        disabled={pedido !== null}
                        onClick={() => rolarPericia(p)}
                      >
                        d20
                      </button>
                      <div className="grau-toggle">
                        {GRAUS.map((g) => (
                          <button
                            key={g.valor}
                            data-ativo={grauAtual === g.valor}
                            onClick={() => definirGrau(p.id, g.valor)}
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
