import Avatar from '../../components/Avatar';

interface Props {
  nome: string;
  corVisual: string;
  visivel: boolean;
  foto?: string | null;
  silhueta?: string | null;
  notas?: string;
}

export default function NpcPublicaView({ nome, corVisual, visivel, foto, silhueta, notas }: Props) {
  if (!visivel) return null;

  return (
    <section className="secao npc-publica-view">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <Avatar nome={nome} cor={corVisual} foto={foto} silhueta={silhueta} bordaCor={corVisual} tamanho={40} />
        <h3 className="label" style={{ margin: 0 }}>
          {nome || 'sem nome'}
        </h3>
      </div>
      {notas && (
        <p className="vazio" style={{ fontSize: 11, margin: '0.4rem 0 0', color: 'var(--ruido)', fontStyle: 'italic' }}>
          {notas}
        </p>
      )}
    </section>
  );
}
