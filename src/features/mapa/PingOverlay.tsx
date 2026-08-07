import { useEffect } from 'react';
import { usePingsStore } from '../../state/pingsStore';
import type { Ponto } from './mapaUtils';

/** Um ping fica visível por `MS_ATE_SUMIR` — bem mais curto que a régua (4s): é um sinal
 *  instantâneo ("olha aqui"), não uma medição que precisa ficar legível na tela. */
const MS_ATE_SUMIR = 1400;
const INTERVALO_VARREDURA_MS = 250;

interface Props {
  imgRenderRect: { offsetX: number; offsetY: number; renderW: number; renderH: number } | null;
  tamanho: { width: number; height: number };
}

/**
 * Desenha todos os pings vivos (`pingsStore.ts`) por cima do mapa — GM e jogadores compartilham
 * este componente, mesmo molde de `ReguaOverlay.tsx`. `pointer-events: none` no SVG inteiro (a
 * interação mora em `useRegua.ts`, na `.mapa-area` por baixo — um clique sem arrasto vira ping
 * em vez de régua).
 *
 * O pulso é CSS puro (`@keyframes mapa-ping-pulso`, single-shot via `animation-fill-mode:
 * forwards`) — sem cálculo de fade quadro a quadro. O `setInterval` aqui só varre e remove do
 * store os pings já expirados, pra não deixar o estado crescer.
 */
export default function PingOverlay({ imgRenderRect, tamanho }: Props) {
  const pings = usePingsStore((s) => s.pings);
  const expirarAntigos = usePingsStore((s) => s.expirarAntigos);

  useEffect(() => {
    const id = setInterval(() => expirarAntigos(Date.now(), MS_ATE_SUMIR), INTERVALO_VARREDURA_MS);
    return () => clearInterval(id);
  }, [expirarAntigos]);

  const lista = Object.values(pings);
  if (lista.length === 0 || tamanho.width <= 0 || tamanho.height <= 0) return null;

  const paraPx = (p: Ponto): Ponto =>
    imgRenderRect
      ? { x: imgRenderRect.offsetX + p.x * imgRenderRect.renderW, y: imgRenderRect.offsetY + p.y * imgRenderRect.renderH }
      : { x: p.x * tamanho.width, y: p.y * tamanho.height };

  return (
    <svg className="mapa-ping-svg" width={tamanho.width} height={tamanho.height} viewBox={`0 0 ${tamanho.width} ${tamanho.height}`}>
      {lista.map((ping) => {
        const p = paraPx(ping.ponto);
        return (
          <g key={ping.id} className="mapa-ping-grupo" style={{ color: ping.cor }}>
            <circle className="mapa-ping-anel" cx={p.x} cy={p.y} r={8} />
            <circle className="mapa-ping-centro" cx={p.x} cy={p.y} r={4} />
          </g>
        );
      })}
    </svg>
  );
}
