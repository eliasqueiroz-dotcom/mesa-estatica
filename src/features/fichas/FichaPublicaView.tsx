import type { FichaPublica } from '../../multiplayer/fichaSplit';

interface Props {
  ficha: FichaPublica;
}

export default function FichaPublicaView({ ficha }: Props) {
  return (
    <section className="secao ficha-publica-view">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <span
          aria-hidden
          style={{ background: ficha.corVisual, width: 14, height: 14, borderRadius: '50%', display: 'inline-block', flexShrink: 0 }}
        />
        <h3 className="label" style={{ margin: 0 }}>
          {ficha.nome || 'sem nome'}
        </h3>
      </div>
    </section>
  );
}
