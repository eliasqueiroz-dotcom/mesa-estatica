import mammoth from 'mammoth';

/**
 * Extrai o texto puro de um .docx 100% no navegador (mammoth roda em cima do ArrayBuffer, sem
 * rede) — o arquivo em si nunca sai daqui; só o texto resultante segue pra IA (ver
 * `converter-ficha-docx` em supabase/functions e ImportarPersonagemBotao.tsx).
 */
export async function extrairTextoDocx(arquivo: File): Promise<string> {
  const arrayBuffer = await arquivo.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer });
  if (!value.trim()) throw new Error('não achei texto nesse .docx — confira se o arquivo não está vazio ou corrompido.');
  return value;
}
