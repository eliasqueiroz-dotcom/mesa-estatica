/**
 * Comprime uma imagem enviada pra caber no orçamento do localStorage (~5MB) — redimensiona pra no
 * máximo LARGURA_MAXIMA de largura mantendo proporção e reexporta como JPEG (arquitetura.md).
 */
const LARGURA_MAXIMA = 1600;
const QUALIDADE_JPEG = 0.82;

const TAMANHO_AVATAR = 256;
const QUALIDADE_AVATAR = 0.85;

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

export async function comprimirImagem(arquivo: File): Promise<string> {
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
  return canvas.toDataURL('image/jpeg', QUALIDADE_JPEG);
}

/** Recorte central quadrado (cover) + resize pra TAMANHO_AVATAR — foto de perfil de Ficha (Avatar.tsx). */
export async function comprimirImagemAvatar(arquivo: File): Promise<string> {
  const img = await carregarImagem(arquivo);
  const lado = Math.min(img.width, img.height);
  const sx = (img.width - lado) / 2;
  const sy = (img.height - lado) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = TAMANHO_AVATAR;
  canvas.height = TAMANHO_AVATAR;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas indisponível');
  ctx.drawImage(img, sx, sy, lado, lado, 0, 0, TAMANHO_AVATAR, TAMANHO_AVATAR);
  return canvas.toDataURL('image/jpeg', QUALIDADE_AVATAR);
}
