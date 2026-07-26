interface Props {
  nome: string;
  corVisual: string;
  visivel: boolean;
}

export default function NpcPublicaView({ nome, corVisual, visivel }: Props) {
  if (!visivel) return null;

  return (
    <section className="secao npc-publica-view">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <span
          aria-hidden
          style={{ background: corVisual, width: 14, height: 14, borderRadius: '50%', display: 'inline-block', flexShrink: 0 }}
        />
        <h3 className="label" style={{ margin: 0 }}>
          {nome || 'sem nome'}
        </h3>
      </div>
    </section>
  );
}
