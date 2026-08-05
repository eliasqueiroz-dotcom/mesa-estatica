import { useAoeStore } from '../../state/aoeStore';
import { tamanhoTemplateEmCelulas } from './aoeGeometria';
import { tamanhoCelula, type Ponto } from './mapaUtils';
import type { GradeMapa } from '../../state/types';

interface Props {
  imgRenderRect: { offsetX: number; offsetY: number; renderW: number; renderH: number } | null;
  tamanho: { width: number; height: number };
  grade: GradeMapa;
}

/**
 * Só o desenho da área de efeito ativa — sem toolbar, sem captura de ponteiro, sem painel de
 * dano/condição. Compartilhado entre `AoEOverlay.tsx` (mestre — o único que escreve em
 * `useAoeStore`, via `aoeSync.ts`) e `MapaJogadorView.tsx` (jogador — só lê). Seguro nos dois
 * bundles: não expõe nenhuma ação de mestre, só a forma que já está sincronizada.
 */
export default function AoEViewOverlay({ imgRenderRect, tamanho, grade }: Props) {
  const template = useAoeStore((s) => s.template);

  const paraPx = (p: Ponto): Ponto =>
    imgRenderRect
      ? { x: imgRenderRect.offsetX + p.x * imgRenderRect.renderW, y: imgRenderRect.offsetY + p.y * imgRenderRect.renderH }
      : { x: p.x * tamanho.width, y: p.y * tamanho.height };

  const celula = tamanhoCelula(grade);
  const tamanhoCelulaPx = celula
    ? {
        w: imgRenderRect ? celula.larguraCelula * imgRenderRect.renderW : celula.larguraCelula * tamanho.width,
        h: imgRenderRect ? celula.alturaCelula * imgRenderRect.renderH : celula.alturaCelula * tamanho.height,
      }
    : null;

  if (!template || !tamanhoCelulaPx || tamanho.width <= 0) return null;

  const origemPx = paraPx(template.origem);
  const raioCelulas = tamanhoTemplateEmCelulas(template, grade);
  const rx = raioCelulas * tamanhoCelulaPx.w;
  const ry = raioCelulas * tamanhoCelulaPx.h;

  return (
    <svg className="mapa-aoe-svg" width={tamanho.width} height={tamanho.height} viewBox={`0 0 ${tamanho.width} ${tamanho.height}`}>
      {template.forma === 'circulo' ? (
        <ellipse className="mapa-aoe-forma" cx={origemPx.x} cy={origemPx.y} rx={rx} ry={ry} />
      ) : (
        <rect className="mapa-aoe-forma" x={origemPx.x - rx} y={origemPx.y - ry} width={rx * 2} height={ry * 2} />
      )}
    </svg>
  );
}
