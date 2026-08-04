import { useEffect } from 'react';
import { useReguasStore } from '../../state/reguasStore';
import type { GradeMapa } from '../../state/types';
import { distanciaEmCelulas, distanciaTotal, formatarDistancia, type Ponto } from './mapaUtils';

/** Uma régua fica plenamente visível por `MS_ATE_SUMIR` depois do último ponto (pointerup) e
 *  então se apaga em `MS_FADE` — ver 1.5 do PLANO_REGUA_E_COMBATE.md. Réguas ainda `ativa`
 *  (sendo arrastadas) nunca entram nessa contagem. */
const MS_ATE_SUMIR = 4000;
const MS_FADE = 600;
const INTERVALO_VARREDURA_MS = 250;

interface Props {
  imgRenderRect: { offsetX: number; offsetY: number; renderW: number; renderH: number } | null;
  tamanho: { width: number; height: number };
  grade: GradeMapa;
}

/**
 * Desenha todas as réguas vivas (`reguasStore.ts`) por cima do mapa — GM e jogadores compartilham
 * este componente. `pointer-events: none` no SVG inteiro (a interação mora em `useRegua.ts`, na
 * `.mapa-area` por baixo); cada régua na cor de quem está medindo (`ReguaViva.cor`).
 *
 * O fade não é calculado quadro a quadro em JS: uma régua que vira `ativa: false` recebe
 * `opacity: 0` com `transition-delay` já embutido (`MS_ATE_SUMIR - MS_FADE`) — o navegador anima
 * sozinho. O `setInterval` aqui só varre e remove do store as réguas já expiradas, pra não deixar
 * o estado crescer; a remoção sempre chega depois da régua já estar invisível.
 */
export default function ReguaOverlay({ imgRenderRect, tamanho, grade }: Props) {
  const reguas = useReguasStore((s) => s.reguas);
  const expirarAntigas = useReguasStore((s) => s.expirarAntigas);

  useEffect(() => {
    const id = setInterval(() => expirarAntigas(Date.now(), MS_ATE_SUMIR), INTERVALO_VARREDURA_MS);
    return () => clearInterval(id);
  }, [expirarAntigas]);

  const lista = Object.values(reguas);
  if (lista.length === 0 || tamanho.width <= 0 || tamanho.height <= 0) return null;

  const paraPx = (p: Ponto): Ponto =>
    imgRenderRect
      ? { x: imgRenderRect.offsetX + p.x * imgRenderRect.renderW, y: imgRenderRect.offsetY + p.y * imgRenderRect.renderH }
      : { x: p.x * tamanho.width, y: p.y * tamanho.height };

  return (
    <svg className="mapa-regua-svg" width={tamanho.width} height={tamanho.height} viewBox={`0 0 ${tamanho.width} ${tamanho.height}`}>
      {lista.map((regua) => {
        const pontosPx = regua.pontos.map(paraPx);
        const ultimo = pontosPx[pontosPx.length - 1];
        const total = distanciaTotal(regua.pontos, grade);
        const temMaisDeUmSegmento = regua.pontos.length > 2;
        return (
          <g
            key={regua.id}
            className="mapa-regua-grupo"
            style={{
              color: regua.cor,
              opacity: regua.ativa ? 1 : 0,
              transition: regua.ativa ? 'none' : `opacity ${MS_FADE}ms ease ${Math.max(0, MS_ATE_SUMIR - MS_FADE)}ms`,
            }}
          >
            <polyline className="mapa-regua-linha" points={pontosPx.map((p) => `${p.x},${p.y}`).join(' ')} />
            {pontosPx.map((p, i) => (
              <circle key={i} className="mapa-regua-ponto" cx={p.x} cy={p.y} r={4} />
            ))}
            {temMaisDeUmSegmento &&
              regua.pontos.slice(1).map((p, i) => {
                const anterior = regua.pontos[i];
                const segDist = distanciaEmCelulas(anterior, p, grade) * grade.escala;
                const meio = paraPx({ x: (anterior.x + p.x) / 2, y: (anterior.y + p.y) / 2 });
                return (
                  <text key={i} className="mapa-regua-rotulo mapa-regua-rotulo--segmento" x={meio.x} y={meio.y - 6} textAnchor="middle">
                    {formatarDistancia(segDist, grade.unidade)}
                  </text>
                );
              })}
            {pontosPx.length > 1 && (
              <text className="mapa-regua-rotulo" x={ultimo.x} y={ultimo.y - 12} textAnchor="middle">
                {formatarDistancia(total, grade.unidade)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
