/**
 * Comprime uma imagem enviada pra caber no orçamento do localStorage (~5MB) — redimensiona pra no
 * máximo LARGURA_MAXIMA de largura mantendo proporção e reexporta como JPEG (arquitetura.md).
 */
const LARGURA_MAXIMA = 1600;
const QUALIDADE_JPEG = 0.82;

export function comprimirImagem(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error('falha ao ler o arquivo'));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('arquivo não é uma imagem válida'));
      img.onload = () => {
        const escala = Math.min(1, LARGURA_MAXIMA / img.width);
        const largura = Math.round(img.width * escala);
        const altura = Math.round(img.height * escala);
        const canvas = document.createElement('canvas');
        canvas.width = largura;
        canvas.height = altura;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas indisponível'));
          return;
        }
        ctx.drawImage(img, 0, 0, largura, altura);
        resolve(canvas.toDataURL('image/jpeg', QUALIDADE_JPEG));
      };
      img.src = leitor.result as string;
    };
    leitor.readAsDataURL(arquivo);
  });
}
