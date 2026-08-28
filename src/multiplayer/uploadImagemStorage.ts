import { supabase } from '../lib/supabaseClient';

export interface ResultadoUploadImagem {
  url: string | null;
  /** Só presente quando TODAS as tentativas falharam — quem chama usa isso pra avisar o
   *  usuário em vez de deixar a falha silenciosa (achado ao vivo em 28/08: sem isso, um
   *  upload que falhasse — RLS, rede, timeout — deixava a ficha presa com a dataURL local
   *  pra sempre, sem nenhum aviso, porque `ehDataUrl()` nunca deixa esse valor sincronizar). */
  erro?: string;
}

const TENTATIVAS = 3;
// path novo por tentativa (não reusa o mesmo) — se uma tentativa anterior na verdade gravou
// mas o cliente perdeu a resposta (timeout pós-escrita), reusar o path faria a próxima
// tentativa colidir. Custo: um possível objeto órfão de poucos KB no bucket, aceitável (já
// não existe job de limpeza pra isso hoje).
const ATRASOS_MS = [0, 400, 1200];

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sobe um blob de imagem já comprimido (`comprimirImagem.ts`/`comprimirImagemAvatar`) pro
 * bucket `midia`, prefixo `img/` — mesmo bucket do áudio (reuso deliberado, ver migração
 * 0031_storage_imagens_ficha_dono.sql), path `img/{pasta}/{uuid}.jpg`. Tenta algumas vezes
 * (`TENTATIVAS`, backoff curto) antes de desistir — falha transitória de rede não deveria
 * exigir que o usuário re-selecione o arquivo. `url: null` sem `erro` só ocorre sem Supabase
 * configurado (modo 100% local, não é falha); com `erro` preenchido, todas as tentativas
 * esgotaram e quem chama deve avisar o usuário.
 *
 * `pasta` já vem pronta com o id do dono quando aplicável (ex.: `npcs/{npcId}`,
 * `fichas/{fichaId}`) — a policy de dono de ficha (migração 0031) depende desse path exato.
 */
export async function uploadImagemStorage(pasta: string, blob: Blob): Promise<ResultadoUploadImagem> {
  const cliente = supabase;
  if (!cliente) return { url: null };

  for (let tentativa = 0; tentativa < TENTATIVAS; tentativa++) {
    if (ATRASOS_MS[tentativa]) await esperar(ATRASOS_MS[tentativa]);
    const path = `img/${pasta}/${crypto.randomUUID()}.jpg`;
    const { error } = await cliente.storage.from('midia').upload(path, blob, { contentType: 'image/jpeg' });
    if (!error) return { url: cliente.storage.from('midia').getPublicUrl(path).data.publicUrl };
    console.error(`[uploadImagemStorage] tentativa ${tentativa + 1}/${TENTATIVAS} falhou`, error);
  }
  return { url: null, erro: 'não foi possível enviar a foto pro servidor — por enquanto só você está vendo ela.' };
}
