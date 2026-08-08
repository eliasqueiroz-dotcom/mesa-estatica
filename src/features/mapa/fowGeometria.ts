import type { EstadoFoW, RegiaoFoW } from '../../state/types';
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
  if (regioes.length === 0) {
    // NUNCA devolver `mask-image: none` aqui: em CSS isso significa "sem máscara", ou seja, a
    // camada aparece INTEIRA — o oposto de "não aparece em região nenhuma". Era exatamente esse
    // o bug de "a área revelada continua coberta": revelar põe a região em `vistas` E em
    // `visiveisAgora`, então `vistas \ visiveisAgora` fica vazio e a camada `visto` (véu escuro
    // + backdrop-filter) cobria o mapa todo, inclusive o que acabou de ser revelado.
    // `inverter` só escolhe a cor da base: branca mostra em tudo, preta esconde em tudo.
    const base = inverter ? '#fff' : '#000';
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1000' height='1000'><rect width='1000' height='1000' fill='${base}'/></svg>`;
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

/** true se o jogador pode mover o token pro ponto `p` com FoW no estado `fow` — sempre true se
 *  FoW está desligado; senão exige estar dentro de alguma região visiveisAgora. */
export function podeMoverTokenParaFoW(fow: Pick<EstadoFoW, 'ativa' | 'visiveisAgora'>, p: Ponto): boolean {
  if (!fow.ativa) return true;
  return fow.visiveisAgora.some((r) => pontoDentroRegiao(p, r));
}

/** Retângulo simples em 0-1 da imagem — o shape geométrico de `RegiaoFoW` sem id/forma/zona. */
export type Caixa = Pick<RegiaoFoW, 'x' | 'y' | 'w' | 'h'>;

/** true se os dois retângulos têm alguma área em comum (encostar de raspão não conta). */
export function caixasIntersectam(a: Caixa, b: Caixa): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

/**
 * `a` menos `b`: devolve os pedaços de `a` que sobram depois de recortar `b`.
 *
 * É o que faz "cobrir uma área específica" funcionar. Antes, cobrir removia por inteiro toda
 * região revelada que o retângulo encostasse — cobrir um cantinho apagava a luz do cômodo todo,
 * e cobrir onde não havia nada revelado não fazia absolutamente nada.
 *
 * Corta em até 4 faixas (acima, abaixo, esquerda, direita), sem sobreposição entre elas:
 *
 *     +----------------+
 *     |     acima      |
 *     +-----+----+-----+
 *     | esq |  b | dir |
 *     +-----+----+-----+
 *     |     abaixo     |
 *     +----------------+
 *
 * Sem interseção devolve `[a]` intacto; se `b` cobre `a` inteiro, devolve `[]`.
 */
export function subtrairCaixa(a: Caixa, b: Caixa): Caixa[] {
  if (!caixasIntersectam(a, b)) return [a];

  const partes: Caixa[] = [];
  const topoCorte = Math.max(a.y, b.y);
  const baseCorte = Math.min(a.y + a.h, b.y + b.h);

  if (b.y > a.y) partes.push({ x: a.x, y: a.y, w: a.w, h: b.y - a.y });
  if (b.y + b.h < a.y + a.h) {
    const y = b.y + b.h;
    partes.push({ x: a.x, y, w: a.w, h: a.y + a.h - y });
  }
  // as laterais só ocupam a faixa vertical que o recorte realmente atinge, pra não sobrepor
  // as faixas de cima/baixo (regiões duplicadas fariam a máscara pintar duas vezes).
  const alturaMeio = baseCorte - topoCorte;
  if (alturaMeio > 0) {
    if (b.x > a.x) partes.push({ x: a.x, y: topoCorte, w: b.x - a.x, h: alturaMeio });
    if (b.x + b.w < a.x + a.w) {
      const x = b.x + b.w;
      partes.push({ x, y: topoCorte, w: a.x + a.w - x, h: alturaMeio });
    }
  }
  return partes;
}

/**
 * `regioes` menos TODAS as caixas de `remover` — diferença GEOMÉTRICA, não por id.
 *
 * É o que separa "vista mas apagada" de "vista e acesa" na renderização. Fazer isso por id não
 * funciona: `cobrirAreaFoW` (store.ts) recorta a região acesa e gera ids novos pros pedaços que
 * sobram, então o id da entrada em `vistas` deixa de existir em `visiveisAgora` e a região
 * inteira era classificada como memória degradada — até a parte que continuava acesa.
 */
export function subtrairRegioes(regioes: Caixa[], remover: Caixa[]): Caixa[] {
  if (remover.length === 0) return regioes;
  return regioes.flatMap((r) =>
    remover.reduce<Caixa[]>((partes, b) => partes.flatMap((p) => subtrairCaixa(p, b)), [r]),
  );
}