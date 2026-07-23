import { ATRIBUTOS, PERICIAS, type GrauPericia } from '../../../rules/data/pericias';
import type { SecaoFichaProps } from '../tipos';

const GRAUS: { valor: GrauPericia; label: string }[] = [
  { valor: 0, label: '—' },
  { valor: 3, label: 'T' },
  { valor: 6, label: 'V' },
];

export default function PericiasSection({ ficha, onChange }: SecaoFichaProps) {
  const definirGrau = (periciaId: string, grau: GrauPericia) => {
    onChange({ pericias: { ...ficha.pericias, [periciaId]: grau } });
  };

  return (
    <section className="secao">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h3 className="label" style={{ margin: 0 }}>Perícias</h3>
        <span className="vazio" style={{ fontSize: 10 }}>— · T=treinado · V=veterano</span>
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
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
