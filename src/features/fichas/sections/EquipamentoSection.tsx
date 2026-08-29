import type { SecaoFichaProps } from '../tipos';

export default function EquipamentoSection({ ficha, onChange }: SecaoFichaProps) {
  return (
    <section className="secao">
      <h3 className="label">Equipamento</h3>
      <div className="campos-grid">
        <div className="campo-largo">
          <label htmlFor="eq-kit">Kit do Antecedente</label>
          <textarea
            id="eq-kit"
            rows={4}
            value={ficha.kitAntecedente}
            onChange={(e) => onChange({ kitAntecedente: e.target.value })}
          />
        </div>
        <div className="campo-largo">
          <label htmlFor="eq-contato">Contato ou Recurso</label>
          <textarea
            id="eq-contato"
            rows={4}
            value={ficha.contatoOuRecurso}
            onChange={(e) => onChange({ contatoOuRecurso: e.target.value })}
          />
        </div>
        <div className="campo-largo">
          <label htmlFor="eq-outros">Outros itens</label>
          <textarea
            id="eq-outros"
            rows={4}
            value={ficha.outrosItens}
            onChange={(e) => onChange({ outrosItens: e.target.value })}
          />
        </div>
      </div>
      <p className="vazio" style={{ marginTop: '0.5rem' }}>
        uma cena por caso em que o contato consegue, informa ou abre algo por você. pedir demais queima.
      </p>
    </section>
  );
}
