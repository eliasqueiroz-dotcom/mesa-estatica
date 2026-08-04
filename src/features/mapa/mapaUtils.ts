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

// ===== Régua de medição — distâncias sobre o grid (0-1 normalizado à IMAGEM, mesma base de
// TokenMapa/GradeMapa) =====

import type { GradeMapa, UnidadeMedida } from '../../state/types';

export interface Ponto {
  x: number;
  y: number;
}

/** Tamanho de uma célula do grid, em coordenada normalizada (0-1) da imagem. `null` se a
 *  geometria da grade ainda não permite dividir em células (import inicial, resize em curso).
 *  Exportada pra uso fora daqui (área de efeito, `aoeGeometria.ts`) — mesma unidade "células"
 *  que a régua já usa pra medir distância. */
export function tamanhoCelula(grade: GradeMapa): { larguraCelula: number; alturaCelula: number } | null {
  if (grade.largura <= 0 || grade.altura <= 0 || grade.colunas <= 0 || grade.linhas <= 0) return null;
  return {
    larguraCelula: (grade.largura / 100) / grade.colunas,
    alturaCelula: (grade.altura / 100) / grade.linhas,
  };
}

/** Snap ao centro da célula do grid mais próxima. Sem grid ativo (ou geometria inválida),
 *  devolve a posição crua — medição livre, sem trava. Extrapola pra fora dos limites do grid
 *  configurado usando o mesmo tamanho de célula (medir além da borda desenhada continua correto). */
export function centroDaCelula(x: number, y: number, grade: GradeMapa): Ponto {
  if (!grade.ativa) return { x, y };
  const celula = tamanhoCelula(grade);
  if (!celula) return { x, y };
  const { larguraCelula, alturaCelula } = celula;
  const gx = grade.x / 100;
  const gy = grade.y / 100;
  const col = Math.floor((x - gx) / larguraCelula);
  const row = Math.floor((y - gy) / alturaCelula);
  return {
    x: gx + (col + 0.5) * larguraCelula,
    y: gy + (row + 0.5) * alturaCelula,
  };
}

/** Distância entre dois pontos em Nº DE CÉLULAS (não em metros ainda) — diagonal euclidiana:
 *  uma célula na diagonal conta √2 células, não 1 (estilo Roll20), coerente com as distâncias
 *  métricas de regras.md. Usa a geometria da grade mesmo com `grade.ativa === false` (só o
 *  snap depende de `ativa`; a escala continua valendo — grid "desligado" ainda mede certo). */
export function distanciaEmCelulas(a: Ponto, b: Ponto, grade: GradeMapa): number {
  const celula = tamanhoCelula(grade);
  if (!celula) return 0;
  const dCol = (b.x - a.x) / celula.larguraCelula;
  const dRow = (b.y - a.y) / celula.alturaCelula;
  return Math.hypot(dCol, dRow);
}

/** Soma a distância de cada segmento da polilinha (waypoints incluídos) e converte pra unidade
 *  da grade (`grade.escala` por célula). */
export function distanciaTotal(pontos: Ponto[], grade: GradeMapa): number {
  let celulas = 0;
  for (let i = 1; i < pontos.length; i++) {
    celulas += distanciaEmCelulas(pontos[i - 1], pontos[i], grade);
  }
  return celulas * grade.escala;
}

/** pt-BR, vírgula decimal, minúsculas, sem exclamação (arte.md). Em `km`, valores abaixo de 1
 *  aparecem em metros ("750 m" em vez de "0,75 km") — mais legível pra deslocamento a pé. */
export function formatarDistancia(valor: number, unidade: UnidadeMedida): string {
  if (unidade === 'km' && valor < 1) {
    return `${(valor * 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} m`;
  }
  const casas = unidade === 'km' ? 2 : 1;
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: casas })} ${unidade}`;
}

const DESLOCAMENTO_M = 9; // regras.md: 1 Ação + 1 Deslocamento (9 m)

/** Rótulo auxiliar em unidades de Deslocamento (9 m), pra referência rápida em combate. */
export function emDeslocamentos(metros: number): string {
  const qtd = Math.round((metros / DESLOCAMENTO_M) * 2) / 2; // precisão de meio deslocamento
  const texto = qtd.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return `${texto} deslocamento${qtd === 1 ? '' : 's'}`;
}
