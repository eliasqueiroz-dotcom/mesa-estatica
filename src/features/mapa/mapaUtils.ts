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

/** extrai a primeira letra do primeiro nome e a primeira letra do último nome
 *  ex: "Guarda 1" → "G1", "Maria Silva" → "MS", "João" → "J" */
export const iniciaisToken = (nome: string): string => {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const primeira = partes[0].charAt(0).toUpperCase();
  if (partes.length === 1) return primeira;
  return primeira + partes[partes.length - 1].charAt(0).toUpperCase();
};
