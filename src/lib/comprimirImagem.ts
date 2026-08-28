/**
 * Comprime uma imagem enviada — redimensiona pra no máximo LARGURA_MAXIMA de largura mantendo
 * proporção e reexporta como JPEG (arquitetura.md).
 */
const LARGURA_MAXIMA = 1600;
const QUALIDADE_JPEG = 0.82;

const TAMANHO_AVATAR = 384;
const QUALIDADE_AVATAR = 0.88;

/** Data URL (pintura local imediata, funciona sem Supabase) + Blob (upload pro Storage) do
 *  mesmo canvas já redimensionado/recortado — nenhum dos dois refaz o resize/crop. */
export interface ImagemComprimida {
  dataUrl: string;
  blob: Blob;
}

function carregarImagem(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error('falha ao ler o arquivo'));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('arquivo não é uma imagem válida'));
      img.onload = () => resolve(img);
      img.src = leitor.result as string;
    };
    leitor.readAsDataURL(arquivo);
  });
}

function canvasParaBlob(canvas: HTMLCanvasElement, qualidade: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob retornou vazio'))),
      'image/jpeg',
      qualidade,
    );
  });
}

export async function comprimirImagem(arquivo: File): Promise<ImagemComprimida> {
  const img = await carregarImagem(arquivo);
  const escala = Math.min(1, LARGURA_MAXIMA / img.width);
  const largura = Math.round(img.width * escala);
  const altura = Math.round(img.height * escala);
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas indisponível');
  ctx.drawImage(img, 0, 0, largura, altura);
  const [dataUrl, blob] = await Promise.all([
    Promise.resolve(canvas.toDataURL('image/jpeg', QUALIDADE_JPEG)),
    canvasParaBlob(canvas, QUALIDADE_JPEG),
  ]);
  return { dataUrl, blob };
}

function desenharAvatarNoCanvas(img: HTMLImageElement, sx: number, sy: number, lado: number): Promise<ImagemComprimida> {
  const canvas = document.createElement('canvas');
  canvas.width = TAMANHO_AVATAR;
  canvas.height = TAMANHO_AVATAR;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas indisponível');
  ctx.drawImage(img, sx, sy, lado, lado, 0, 0, TAMANHO_AVATAR, TAMANHO_AVATAR);
  return Promise.all([
    Promise.resolve(canvas.toDataURL('image/jpeg', QUALIDADE_AVATAR)),
    canvasParaBlob(canvas, QUALIDADE_AVATAR),
  ]).then(([dataUrl, blob]) => ({ dataUrl, blob }));
}

/** Recorte central quadrado (cover) + resize pra TAMANHO_AVATAR — foto de perfil de NPC
 *  (`NpcsTab.tsx`, sem crop manual). Ficha usa `comprimirImagemAvatarComRecorte` abaixo, com
 *  o recorte vindo do `CropFotoModal` em vez de calculado automático. */
export async function comprimirImagemAvatar(arquivo: File): Promise<ImagemComprimida> {
  const img = await carregarImagem(arquivo);
  const lado = Math.min(img.width, img.height);
  const sx = (img.width - lado) / 2;
  const sy = (img.height - lado) / 2;
  return desenharAvatarNoCanvas(img, sx, sy, lado);
}

/** Retângulo de recorte em pixels da imagem ORIGINAL (não da já comprimida) — mesmo shape que
 *  `react-easy-crop` devolve em `onCropComplete`'s `croppedAreaPixels`. */
export interface RecorteAvatar {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Garante que o recorte cai dentro dos limites da imagem — defesa barata contra
 *  arredondamento do `react-easy-crop` devolver x/y/width/height fracionalmente fora da
 *  borda (ex.: zoom no limite, imagem com dimensão ímpar). Função pura, sem DOM — testável
 *  direto em vitest, ao contrário do resto deste arquivo (depende de `<canvas>`/`Image` reais). */
export function normalizarRecorte(recorte: RecorteAvatar, imgWidth: number, imgHeight: number): RecorteAvatar {
  const width = Math.min(recorte.width, imgWidth);
  const height = Math.min(recorte.height, imgHeight);
  const x = Math.min(Math.max(recorte.x, 0), imgWidth - width);
  const y = Math.min(Math.max(recorte.y, 0), imgHeight - height);
  return { x, y, width, height };
}

/** Igual a `comprimirImagemAvatar`, mas o recorte vem da interação do usuário no
 *  `CropFotoModal` em vez de calculado automático (centro) — usado pela ficha. `recorte` já
 *  vem 1:1 (largura===altura, `aspect={1}` no react-easy-crop), mas passa por
 *  `normalizarRecorte` mesmo assim. */
export async function comprimirImagemAvatarComRecorte(arquivo: File, recorte: RecorteAvatar): Promise<ImagemComprimida> {
  const img = await carregarImagem(arquivo);
  const r = normalizarRecorte(recorte, img.width, img.height);
  return desenharAvatarNoCanvas(img, r.x, r.y, r.width);
}
