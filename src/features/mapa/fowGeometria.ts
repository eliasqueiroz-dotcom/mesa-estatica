import type { RegiaoFoW } from '../../state/types';
import type { Ponto } from './mapaUtils';

/** Coordenadas (0-1 da imagem) → px (com offset do letterbox), prontas pra `style.left/top/width`.
 *  Mesmo princípio de `retanguloGradeEmPx` (mapaUtils.ts): `imgRenderRect` nulo (sem imagem
 *  carregada) cai pra % do container — invariante #3 do ROADMAP (relativo à imagem, não ao
 *  container que varia por dispositivo entre mestre/jogador). */
export function regiaoEmPx(
  imgRenderRect: { offsetX: number; offsetY: number; renderW: number; renderH: number } | null,
  r: { x: number; y: number; w: number; h: number },
): { left: string; top: string; width: string; height: string } {
  if (!imgRenderRect) {
    const leftPct = r.x * 100, topPct = r.y * 100, wpct = r.w * 100, hpct = r.h * 100;
    return { left: `${leftPct}%`, top: `${topPct}%`, width: `${wpct}%`, height: `${hpct}%` };
  }
  const { offsetX, offsetY, renderW, renderH } = imgRenderRect;
  return {
    left: `${offsetX + r.x * renderW}px`,
    top: `${offsetY + r.y * renderH}px`,
    width: `${r.w * renderW}px`,
    height: `${r.h * renderH}px`,
  };
}

/** true se o ponto (0-1) cai dentro do retângulo da região. Largura/altura naturais à imagem. */
export function pontoDentroRegiao(p: Ponto, r: Pick<RegiaoFoW, 'x' | 'y' | 'w' | 'h'>): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

/** Monta a string de `mask-image` (SVG inline, data-URI sem asset externo — mesmo princípio
 *  do `feTurbulence` inline em `ruido.css`). SVG viewport fixo em 1000×1000 com `mask-size:
 *  100% 100%` no CSS mapeia 0–1 pra container sem distorcer.
 *
 * Branco = a camada aparece ali; preto = oculta. Isso é a única regra:
 *   - `inverter=false` (default): todas as `regioes` viram rect brancas (mostra a camada SÓ
 *     ali); base preta oculta o resto.
 *   - `inverter=true`: base branca (mostra em todo lugar), regioes viram rect pretas (oculta
 *     a camada DENTRO das regiões) — usado pra camada "nunca visto" em FoW (chiado onde
 *     NÃO tem nenhuma região vista/visivel).
 *
 * Uso corrente:
 *   camada chiado "nunca"  → `montarMaskSvg(vistas ∪ visiveisAgora, true)` — chiado no que
 *     ainda não foi tocado, oculta em `vistas ∪ visiveisAgora`.
 *   camada "visto" (blur)  → `montarMaskSvg(vistas \ visiveisAgora, false)` — mostra o blur
 *     só onde já viu mas a luz apagou.
 *   camada vinheta "visível" → `montarMaskSvg(visiveisAgora, false)` — mostra a vinheta
 *     só onde há luz agora.
 */
export function montarMaskSvg(
  regioes: Pick<RegiaoFoW, 'x' | 'y' | 'w' | 'h'>[],
  inverter = false,
): string {
  if (regioes.length === 0 && !inverter) return 'none';
  if (regioes.length === 0 && inverter) {
    // nada a excluir — máscara totalmente branca (mostra em tudo).
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1000' height='1000'><rect width='1000' height='1000' fill='#fff'/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }
  const corMostra = '#fff';
  const corOculta = '#000';
  const base = inverter ? corMostra : corOculta;
  const front = inverter ? corOculta : corMostra;
  const rectStr = regioes
    .map((r) => {
      const x = (r.x * 1000).toFixed(2);
      const y = (r.y * 1000).toFixed(2);
      const w = (r.w * 1000).toFixed(2);
      const h = (r.h * 1000).toFixed(2);
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${front}"/>`;
    })
    .join('');
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='1000' height='1000'>` +
    `<rect width='1000' height='1000' fill="${base}"/>` + // base
    rectStr +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}