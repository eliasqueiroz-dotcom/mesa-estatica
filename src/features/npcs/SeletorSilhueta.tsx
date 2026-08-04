import { SILHUETAS } from '../../assets/silhuetas/silhuetas';

interface Props {
  valor: string | null;
  onEscolher: (slug: string | null) => void;
}

/** Swatches curados de silhueta (mesmo espírito de SeletorCor.tsx) — sem rosto real, tema
 *  investigação/rua. "Ø" = nenhuma, cai pro fallback iniciais+cor. Fundo `var(--concrete-1)`
 *  explícito nos botões — os ícones usam recortes dessa MESMA cor pra criar contraste real
 *  (badge, friso do capacete, sombra do capuz); sem o fundo combinando, o recorte desalinha. */
export default function SeletorSilhueta({ valor, onEscolher }: Props) {
  return (
    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={() => onEscolher(null)}
        title="sem silhueta (iniciais)"
        style={{
          width: 28,
          height: 28,
          padding: 0,
          borderRadius: '50%',
          background: 'var(--concrete-1)',
          border: valor === null ? '2px solid var(--ink)' : '2px solid transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span className="vazio" style={{ fontSize: 11 }}>Ø</span>
      </button>
      {SILHUETAS.map(({ slug, label, Icone }) => (
        <button
          key={slug}
          type="button"
          onClick={() => onEscolher(slug)}
          title={label}
          style={{
            width: 28,
            height: 28,
            padding: 0,
            borderRadius: '50%',
            background: 'var(--concrete-1)',
            border: valor === slug ? '2px solid var(--ink)' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icone style={{ width: 20, height: 20, color: 'var(--ink-dim)' }} />
        </button>
      ))}
    </div>
  );
}
