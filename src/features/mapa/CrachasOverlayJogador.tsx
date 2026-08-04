import { useCallback, useEffect, useRef, useState } from 'react';
import type { FichaPublica } from '../../multiplayer/fichaSplit';
import type { Ficha } from '../../state/types';
import CrachasLista from './CrachasLista';

interface Props {
  minhaFicha: Ficha;
  outrasFichas: FichaPublica[];
}

/** Espelho de CrachasOverlay.tsx pro app do jogador — mesmas props que MapaJogadorView.tsx já
 *  tem em mãos (sem fetch novo). */
export default function CrachasOverlayJogador({ minhaFicha, outrasFichas }: Props) {
  const [aberto, setAberto] = useState(false);
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
  const [arrastando, setArrastando] = useState<{ origemX: number; origemY: number; painelX: number; painelY: number } | null>(null);
  const painelRef = useRef<HTMLDivElement>(null);

  const toggleAberto = () => {
    setPanelPos(null);
    setAberto((a) => !a);
  };

  const iniciarArrasto = (ev: React.PointerEvent) => {
    if (ev.button !== 0) return;
    const area = document.querySelector('.mapa-area');
    if (!area || !painelRef.current) return;
    const areaRect = area.getBoundingClientRect();
    const painelRect = painelRef.current.getBoundingClientRect();
    const origem = panelPos ?? { x: painelRect.left - areaRect.left, y: painelRect.top - areaRect.top };
    setArrastando({ origemX: ev.clientX, origemY: ev.clientY, painelX: origem.x, painelY: origem.y });
  };

  const moverArrasto = useCallback((ev: PointerEvent) => {
    if (!arrastando) return;
    const area = document.querySelector('.mapa-area');
    if (!area) return;
    const rect = area.getBoundingClientRect();
    const dx = ev.clientX - arrastando.origemX;
    const dy = ev.clientY - arrastando.origemY;
    const alturaPainel = painelRef.current?.offsetHeight ?? 200;
    const larguraPainel = painelRef.current?.offsetWidth ?? 260;
    const maxX = rect.width - larguraPainel - 8;
    const maxY = rect.height - Math.min(alturaPainel + 16, rect.height - 16);
    setPanelPos({
      x: Math.max(0, Math.min(arrastando.painelX + dx, maxX)),
      y: Math.max(8, Math.min(arrastando.painelY + dy, maxY)),
    });
  }, [arrastando]);

  const soltarArrasto = useCallback(() => {
    setArrastando(null);
  }, []);

  useEffect(() => {
    if (!arrastando) return;
    window.addEventListener('pointermove', moverArrasto);
    window.addEventListener('pointerup', soltarArrasto);
    return () => {
      window.removeEventListener('pointermove', moverArrasto);
      window.removeEventListener('pointerup', soltarArrasto);
    };
  }, [arrastando, moverArrasto, soltarArrasto]);

  const personagens = [
    { id: minhaFicha.id, nome: minhaFicha.nome, cor: minhaFicha.corVisual, foto: minhaFicha.foto },
    ...outrasFichas.map((f) => ({ id: f.id, nome: f.nome, cor: f.corVisual, foto: f.foto })),
  ];

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        ...(panelPos ? { left: panelPos.x, top: panelPos.y } : { right: 8, top: 8 }),
      }}
    >
      {aberto && (
        <div
          ref={painelRef}
          className="secao"
          style={{ width: 'min(260px, calc(100% - 8px))', maxHeight: '70vh', overflowY: 'auto', marginBottom: '0.6rem', boxShadow: '0 4px 24px rgba(0,0,0,0.5)', padding: '0.75rem 1rem' }}
        >
          <div
            onPointerDown={iniciarArrasto}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', cursor: arrastando ? 'grabbing' : 'grab', userSelect: 'none', touchAction: 'none' }}
          >
            <h3 className="label" style={{ margin: 0, fontSize: 12 }}>crachás</h3>
            <button className="icone-botao" onClick={toggleAberto} title="fechar" onPointerDown={(ev) => ev.stopPropagation()}>
              ×
            </button>
          </div>
          <CrachasLista personagens={personagens} euId={minhaFicha.id} />
        </div>
      )}
      <button onClick={toggleAberto} title="crachás" style={{ borderRadius: '50%', width: 48, height: 48, padding: 0 }}>
        ID
      </button>
    </div>
  );
}
