import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
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
  const [fotoFalhou, setFotoFalhou] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [arrastando, setArrastando] = useState(false);
  const arrastoRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  useEffect(() => {
    if (!aberta) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberta(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [aberta]);

  // reseta zoom/pan sempre que a foto ampliada fecha, pra não abrir de novo já ampliada.
  useEffect(() => {
    if (!aberta) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [aberta]);

  const resetarZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const aoRolar = (e: WheelEvent) => {
    e.preventDefault();
    setZoom((z) => {
      const novo = Math.min(4, Math.max(1, z - Math.sign(e.deltaY) * 0.35));
      if (novo === 1) setPan({ x: 0, y: 0 });
      return novo;
    });
  };

  const aoIniciarArrasto = (e: PointerEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    arrastoRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    setArrastando(true);
  };

  const aoMoverArrasto = (e: PointerEvent) => {
    if (!arrastoRef.current) return;
    const inicio = arrastoRef.current;
    setPan({ x: inicio.panX + (e.clientX - inicio.x), y: inicio.panY + (e.clientY - inicio.y) });
  };

  const aoSoltarArrasto = () => {
    arrastoRef.current = null;
    setArrastando(false);
  };

  // URL nova (foto trocada) merece uma nova tentativa — só desiste de novo se ela também falhar.
  useEffect(() => {
    setFotoFalhou(false);
  }, [foto]);

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

  if (foto && !fotoFalhou) {
    return (
      <>
        <span
          style={{ ...base, cursor: ampliavel ? 'zoom-in' : undefined }}
          onClick={ampliavel ? () => setAberta(true) : undefined}
          role={ampliavel ? 'button' : undefined}
          tabIndex={ampliavel ? 0 : undefined}
          aria-label={ampliavel ? `ampliar foto de ${nome || 'jogador'}` : undefined}
          onKeyDown={
            ampliavel
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setAberta(true);
                  }
                }
              : undefined
          }
        >
          <img
            src={foto}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setFotoFalhou(true)}
          />
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
              overflow: 'hidden',
              cursor: 'zoom-out',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setAberta(false);
            }}
          >
            <img
              src={foto}
              alt=""
              onWheel={aoRolar}
              onDoubleClick={resetarZoom}
              onPointerDown={aoIniciarArrasto}
              onPointerMove={aoMoverArrasto}
              onPointerUp={aoSoltarArrasto}
              onPointerCancel={aoSoltarArrasto}
              style={{
                maxWidth: '90vw',
                maxHeight: '90vh',
                objectFit: 'contain',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transition: arrastando ? 'none' : 'transform 0.12s ease-out',
                cursor: zoom > 1 ? (arrastando ? 'grabbing' : 'grab') : 'zoom-in',
                touchAction: 'none',
              }}
            />
            <button
              type="button"
              onClick={() => setAberta(false)}
              title="fechar (Esc)"
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1.25rem',
                background: 'var(--concrete-1)',
                border: '1px solid var(--concrete-2)',
                color: 'var(--ink)',
                borderRadius: '50%',
                width: 32,
                height: 32,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: 18,
                lineHeight: 1,
              }}
            >
              ×
            </button>
            {zoom > 1 && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '1.25rem',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  background: 'var(--concrete-1)',
                  border: '1px solid var(--concrete-2)',
                  borderRadius: 4,
                  padding: '0.3rem 0.7rem',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: 'var(--ink-dim)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <span>{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  onClick={resetarZoom}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--concrete-2)',
                    color: 'var(--ink)',
                    borderRadius: 3,
                    padding: '0.15rem 0.5rem',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                  }}
                >
                  resetar
                </button>
              </div>
            )}
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
