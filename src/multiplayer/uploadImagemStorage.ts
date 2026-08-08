import { supabase } from '../lib/supabaseClient';

/**
 * Sobe um blob de imagem já comprimido (`comprimirImagem.ts`/`comprimirImagemAvatar`) pro
 * bucket `midia`, prefixo `img/` — mesmo bucket do áudio (reuso deliberado, ver migração
 * 0031_storage_imagens_ficha_dono.sql), path `img/{pasta}/{uuid}.jpg`. Devolve a URL pública ou
 * `null` em qualquer falha (sem Supabase configurado — modo 100% local — ou upload rejeitado):
 * quem chama cai pra manter a `dataUrl` local em vez de propagar o erro, nunca quebra o fluxo.
 *
 * `pasta` já vem pronta com o id do dono quando aplicável (ex.: `npcs/{npcId}`,
 * `fichas/{fichaId}`) — a policy de dono de ficha (migração 0031) depende desse path exato.
 */
export async function uploadImagemStorage(pasta: string, blob: Blob): Promise<string | null> {
  const cliente = supabase;
  if (!cliente) return null;

  const path = `img/${pasta}/${crypto.randomUUID()}.jpg`;
  const { error } = await cliente.storage.from('midia').upload(path, blob, { contentType: 'image/jpeg' });
  if (error) {
    console.error('[uploadImagemStorage] upload falhou', error);
    return null;
  }
  return cliente.storage.from('midia').getPublicUrl(path).data.publicUrl;
}
