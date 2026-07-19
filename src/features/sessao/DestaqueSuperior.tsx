import { useStore } from '../../state/store';

/** §8 — Destaque superior [Público]: painel sempre visível, deriva de sessaoPublica —
 *  não é estado novo. Montado em App.tsx (fora da aba Sessão) porque "sempre visível" quer
 *  dizer em qualquer aba, não só na de Sessão. */
export default function DestaqueSuperior() {
  const sessaoPublica = useStore((s) => s.sessaoPublica);
  const { localAtual, objetivo, hora } = sessaoPublica;

  if (!localAtual && !objetivo && !hora) return null;

  return (
    <div
      className="mono"
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '1.5rem',
        padding: '0.4rem 1.5rem',
        borderBottom: '1px solid var(--concrete-2)',
        background: 'var(--concrete-0)',
        fontSize: '12px',
        color: 'var(--ink-dim)',
      }}
    >
      {localAtual && (
        <span>
          LOCAL: <span style={{ color: 'var(--ink)' }}>{localAtual.toUpperCase()}</span>
        </span>
      )}
      {objetivo && (
        <span>
          OBJETIVO: <span style={{ color: 'var(--ink)' }}>{objetivo}</span>
        </span>
      )}
      {hora && (
        <span>
          TEMPO: <span style={{ color: 'var(--ink)' }}>{hora}</span>
        </span>
      )}
    </div>
  );
}
