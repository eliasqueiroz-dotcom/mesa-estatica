import { useEffect, useState } from 'react';
import { silhuetaPorSlug } from '../assets/silhuetas/silhuetas';
import { iniciaisToken } from '../features/mapa/mapaUtils';

interface Props {
  nome: string;
  /** cor do NPC/PC (`corVisual`) — usada só como `bordaCor` por quem chama; o ícone de
   *  silhueta tem cor fixa própria por função (ver silhuetas.tsx), não herda mais esta. */
  cor: string;
  /** foto de Ficha (PC) — precedência 1 sobre silhueta/iniciais. */
  foto?: string | null;
  /** silhueta de Npc — precedência 2, ignorada se `foto` estiver presente. */
  silhueta?: string | null;
  /** diâmetro em px. */
  tamanho?: number;
  /** borda própria do círculo — omitir quando o container (ex. `.mapa-token`) já desenha a borda. */
  bordaCor?: string;
  /** permite clicar na foto pra abrir em tamanho cheio — só tem efeito quando há `foto`
   *  (silhueta/iniciais não têm "tamanho cheio" pra mostrar). */
  ampliavel?: boolean;
  style?: React.CSSProperties;
}

/** Avatar reutilizável: foto > silhueta pré-instalada > iniciais+cor (fallback atual, preservado). */
export default function Avatar({ nome, foto, silhueta, tamanho = 32, bordaCor, ampliavel, style }: Props) {
  const [aberta, setAberta] = useState(false);

  useEffect(() => {
    if (!aberta) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberta(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [aberta]);

  const base: React.CSSProperties = {
    width: tamanho,
    height: tamanho,
    borderRadius: '50%',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    border: bordaCor ? `2px solid ${bordaCor}` : undefined,
    ...style,
  };

  if (foto) {
    return (
      <>
        <span
          style={{ ...base, cursor: ampliavel ? 'zoom-in' : undefined }}
          onClick={ampliavel ? () => setAberta(true) : undefined}
        >
          <img src={foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </span>
        {aberta && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(11, 13, 17, 0.85)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'zoom-out',
            }}
            onClick={() => setAberta(false)}
          >
            <img
              src={foto}
              alt=""
              style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}
            />
          </div>
        )}
      </>
    );
  }

  const def = silhuetaPorSlug(silhueta);
  if (def) {
    const { Icone } = def;
    return (
      <span style={{ ...base, background: 'var(--concrete-1)' }}>
        <Icone style={{ width: tamanho * 0.8, height: tamanho * 0.8 }} />
      </span>
    );
  }

  return (
    <span
      style={{
        ...base,
        fontFamily: 'var(--font-mono)',
        fontSize: tamanho * 0.406,
        color: 'var(--ink)',
      }}
    >
      {iniciaisToken(nome)}
    </span>
  );
}
