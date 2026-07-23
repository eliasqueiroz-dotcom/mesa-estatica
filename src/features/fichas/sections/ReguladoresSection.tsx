import { ACESSOS_POR_TIPO, estaDependente } from '../../../rules/reguladores';
import { useStore } from '../../../state/store';
import type { DoseRegulador, TipoRegulador } from '../../../state/types';
import type { SecaoFichaProps } from '../tipos';

export const NOMES_TIPO_REGULADOR: Record<TipoRegulador, string> = {
  generico: 'Genérico de esquina',
  pleno: 'Pleno® com receita',
  ajuste: 'Ajuste clínico',
};

export default function ReguladoresSection({ ficha, onChange }: SecaoFichaProps) {
  const cenaAtual = useStore((s) => s.sessaoPublica.contadorCena);

  const ajustarAcessos = (delta: number) => {
    onChange({ acessos: Math.max(0, ficha.acessos + delta) });
  };

  const registrarDose = (tipo: TipoRegulador) => {
    const dose: DoseRegulador = {
      id: crypto.randomUUID(),
      data: new Date().toISOString(),
      sessao: cenaAtual,
      tipo,
    };
    onChange({
      reguladores: [dose, ...ficha.reguladores],
      acessos: ficha.acessos + ACESSOS_POR_TIPO[tipo],
    });
  };

  const removerDose = (id: string) => {
    onChange({ reguladores: ficha.reguladores.filter((d) => d.id !== id) });
  };

  const dependente = estaDependente(ficha.reguladores.map((d) => d.sessao), cenaAtual);
  const anestesiaAtiva = ficha.anestesiaAte !== null;

  return (
    <section className="secao">
      <h3 className="label">Neuro-reguladores</h3>
      <div className="regulador-stat">
        <div className="derivado-card">
          <div className="derivado-card__label">Acessos (telemetria)</div>
          <div className="derivado-card__valor">{ficha.acessos}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', margin: '0.6rem 0', flexWrap: 'wrap' }}>
        <button className="acento" onClick={() => ajustarAcessos(1)}>
          +1 acesso
        </button>
        <button className="icone-botao perigo" onClick={() => ajustarAcessos(-1)}>
          −1 acesso
        </button>
      </div>

      <div className="badges-linha">
        {dependente && <span className="badge">dependente — -2 vontade sem dose há 1+ dia</span>}
        {anestesiaAtiva && <span className="badge">anestesia ativa</span>}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', margin: '0.6rem 0', flexWrap: 'wrap' }}>
        <button onClick={() => registrarDose('generico')}>+ genérico (R$60)</button>
        <button onClick={() => registrarDose('pleno')}>+ pleno® (P$180)</button>
        <button onClick={() => registrarDose('ajuste')}>+ ajuste clínico</button>
        <button
          className={anestesiaAtiva ? 'perigo' : 'acento'}
          onClick={() => onChange({ anestesiaAte: anestesiaAtiva ? null : new Date().toISOString() })}
        >
          {anestesiaAtiva ? 'encerrar anestesia' : 'marcar anestesia'}
        </button>
      </div>

      {ficha.reguladores.length === 0 ? (
        <p className="vazio">nenhuma dose registrada.</p>
      ) : (
        ficha.reguladores.map((d) => (
          <div key={d.id} className="reguladores-linha mono">
            <span>
              cena {d.sessao} · {NOMES_TIPO_REGULADOR[d.tipo]}
            </span>
            <button className="icone-botao perigo" onClick={() => removerDose(d.id)}>
              ×
            </button>
          </div>
        ))
      )}
    </section>
  );
}
