import { useCallback, useEffect, useRef, useState } from 'react';
import CombateJogadorView from '../iniciativa/CombateJogadorView';
import { useStore } from '../../state/store';
import type { EntradaIniciativa, Ficha } from '../../state/types';

interface Props {
  iniciativa: EntradaIniciativa[];
  minhaFicha: Ficha;
}

export default function CombatOverlayJogador({ iniciativa, minhaFicha }: Props) {
  const { modoCombate, rodada } = useStore((s) => s.sessaoPublica);

  const [aberto, setAberto] = useState(false);
  const [panelPos, setPanelPos] = useState({ x: 8, y: 8 });
  const [arrastando, setArrastando] = useState<{ origemX: number; origemY: number; painelX: number; painelY: number } | null>(null);
  const painelRef = useRef<HTMLDivElement>(null);

  const toggleAberto = () => {
    setPanelPos({ x: 8, y: 8 });
    setAberto((a) => !a);
  };

  useEffect(() => {
    if (!aberto) return;
    const area = document.querySelector('.mapa-area');
    if (!area || !painelRef.current) return;
    const rect = area.getBoundingClientRect();
    const larguraPainel = painelRef.current.offsetWidth;
    const maxX = rect.width - larguraPainel - 8;
    setPanelPos((prev) => ({ x: Math.max(0, Math.min(prev.x, maxX)), y: prev.y }));
  }, [aberto, modoCombate]);

  const iniciarArrasto = (ev: React.PointerEvent) => {
    if (ev.button !== 0) return;
    setArrastando({ origemX: ev.clientX, origemY: ev.clientY, painelX: panelPos.x, painelY: panelPos.y });
  };

  const moverArrasto = useCallback((ev: PointerEvent) => {
    if (!arrastando) return;
    const area = document.querySelector('.mapa-area');
    if (!area) return;
    const rect = area.getBoundingClientRect();
    const dx = ev.clientX - arrastando.origemX;
    const dy = ev.clientY - arrastando.origemY;
    const alturaPainel = painelRef.current?.offsetHeight ?? 200;
    const larguraPainel = painelRef.current?.offsetWidth ?? 380;
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

  return (
    <div
      style={{
        position: 'absolute',
        left: panelPos.x,
        top: panelPos.y,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
      }}
    >
      {aberto && (
        <div
          ref={painelRef}
          className="secao"
          style={{ width: 'calc(100% - 16px)', maxHeight: '70vh', overflowY: 'auto', marginBottom: '0.6rem', boxShadow: '0 4px 24px rgba(0,0,0,0.5)', padding: '0.5rem 0.75rem' }}
        >
          <div
            onPointerDown={iniciarArrasto}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', cursor: arrastando ? 'grabbing' : 'grab', userSelect: 'none', touchAction: 'none' }}
          >
            <h3 className="label" style={{ margin: 0, fontSize: 12 }}>
              combate{modoCombate ? ` · rodada ${rodada}` : ''}
            </h3>
            <button className="icone-botao" onClick={() => { setPanelPos({ x: 8, y: 8 }); setAberto(false); }} title="fechar" onPointerDown={(ev) => ev.stopPropagation()}>
              ×
            </button>
          </div>
          <CombateJogadorView iniciativa={iniciativa} minhaFicha={minhaFicha} semMoldura />
        </div>
      )}
      <button
        onClick={toggleAberto}
        title="combate"
        style={
          modoCombate
            ? { borderRadius: '50%', width: 48, height: 48, padding: 0, borderColor: 'var(--rede-dim)', color: 'var(--rede)' }
            : { borderRadius: '50%', width: 48, height: 48, padding: 0 }
        }
      >
        ATK
      </button>
    </div>
  );
}
