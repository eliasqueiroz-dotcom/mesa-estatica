/** calcula onde a imagem (object-fit: contain) é renderizada dentro do container.
 *  retorna offset (px do canto superior esquerdo do container) e tamanho renderizado. */
export function getImgRenderRect(
  containerW: number, containerH: number,
  imgW: number, imgH: number,
): { offsetX: number; offsetY: number; renderW: number; renderH: number } {
  const containerAspect = containerW / containerH;
  const imgAspect = imgW / imgH;
  if (imgAspect > containerAspect) {
    const renderH = containerW / imgAspect;
    return { offsetX: 0, offsetY: (containerH - renderH) / 2, renderW: containerW, renderH };
  }
  const renderW = containerH * imgAspect;
  return { offsetX: (containerW - renderW) / 2, offsetY: 0, renderW, renderH: containerH };
}

/** Converte as % de `GradeMapa` (x/y/largura/altura, relativas à IMAGEM) pra px absolutos
 *  dentro de `.mapa-area`, usando a mesma fórmula já usada pra posicionar tokens
 *  (`offsetX/offsetY + valor * renderW/renderH`) — sem isso, o grid fica ancorado no
 *  container inteiro (não na área real da imagem letterboxed) e desalinha sempre que a
 *  proporção do container difere da proporção da imagem. `null` (mapa ainda sem imagem
 *  carregada) cai pra % do container, mesmo comportamento de antes. */
export function retanguloGradeEmPx(
  imgRenderRect: { offsetX: number; offsetY: number; renderW: number; renderH: number } | null,
  grade: { x: number; y: number; largura: number; altura: number },
): { left: string; top: string; width: string; height: string } {
  if (!imgRenderRect) {
    return { left: `${grade.x}%`, top: `${grade.y}%`, width: `${grade.largura}%`, height: `${grade.altura}%` };
  }
  const { offsetX, offsetY, renderW, renderH } = imgRenderRect;
  return {
    left: `${offsetX + (grade.x / 100) * renderW}px`,
    top: `${offsetY + (grade.y / 100) * renderH}px`,
    width: `${(grade.largura / 100) * renderW}px`,
    height: `${(grade.altura / 100) * renderH}px`,
  };
}

/** Caixa de CONTEÚDO de um elemento (exclui borda), em coordenadas de viewport — mesma fonte
 *  que `ResizeObserver`'s `contentRect` já usa pra medir `.mapa-area` (`tamanho` state nos
 *  componentes de mapa). `getBoundingClientRect()` cru inclui a borda (`.mapa-area` tem
 *  `border: 1px solid`), o que desalinha o cálculo de posição do ponteiro durante um arrasto
 *  em relação ao `imgRenderRect` usado pra desenhar (calculado a partir do content-box) —
 *  o erro cresce proporcionalmente à distância do canto superior-esquerdo do container. */
export function retanguloConteudo(el: HTMLElement): { left: number; top: number; width: number; height: number } {
  const rect = el.getBoundingClientRect();
  return {
    left: rect.left + el.clientLeft,
    top: rect.top + el.clientTop,
    width: el.clientWidth,
    height: el.clientHeight,
  };
}

/** extrai a primeira letra do primeiro nome e a primeira letra do último nome
 *  ex: "Guarda 1" → "G1", "Maria Silva" → "MS", "João" → "J" */
export const iniciaisToken = (nome: string): string => {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const primeira = partes[0].charAt(0).toUpperCase();
  if (partes.length === 1) return primeira;
  return primeira + partes[partes.length - 1].charAt(0).toUpperCase();
};
