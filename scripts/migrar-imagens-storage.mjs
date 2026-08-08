// Migração única (Fase 6, ROADMAP.md "Migrar imagens pra Supabase Storage"): sobe pro bucket
// 'midia' as imagens que ainda estão em base64 nas colunas `mapa_publico.imagem_data_url`,
// `npcs_publico.foto` e `characters_publico.foto`, e troca a coluna pela URL pública — mesmo
// path que `uploadImagemStorage.ts` já usa (`img/mapa/`, `img/npcs/{id}/`, `img/fichas/{id}/`),
// pra bater com as policies da migração 0031_storage_imagens_ficha_dono.sql.
//
// NÃO roda sozinho em nenhum fluxo automático (postinstall, CI) — mexe em dado de produção da
// campanha real. Rodar manualmente, uma vez, com a service role key só na variável de ambiente
// do shell (nunca em arquivo do repo):
//
//   SUPABASE_SERVICE_ROLE_KEY=xxxx node scripts/migrar-imagens-storage.mjs
//   (ou --dry-run primeiro, pra só listar o que seria migrado sem tocar em nada)
//
// Idempotente: pula qualquer linha cujo valor já comece com "http" (já migrada) ou seja nulo/
// vazio. Pode rodar de novo sem duplicar upload nem reprocessar o que já virou URL.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    '[migrar-imagens] faltam VITE_SUPABASE_URL (ou SUPABASE_URL) e/ou SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente.',
  );
  process.exit(1);
}

const cliente = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Decodifica "data:image/jpeg;base64,XXXX" em {buffer, contentType}. */
function decodificarDataUrl(dataUrl) {
  const casamento = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!casamento) throw new Error('não é uma data URL base64 reconhecida');
  const [, contentType, base64] = casamento;
  return { buffer: Buffer.from(base64, 'base64'), contentType };
}

/**
 * Migra uma tabela/coluna: busca linhas com valor em `data:`, sobe cada uma pro Storage no path
 * calculado por `montarPasta(linha)`, faz update da coluna com a URL pública.
 */
async function migrarColuna({ tabela, colunaImagem, montarPasta, nomeLog }) {
  const { data: linhas, error } = await cliente.from(tabela).select('*');
  if (error) {
    console.error(`[migrar-imagens] falha ao buscar ${tabela}:`, error.message);
    return { migradas: 0, puladas: 0, erros: 1 };
  }

  let migradas = 0;
  let puladas = 0;
  let erros = 0;

  for (const linha of linhas ?? []) {
    const valor = linha[colunaImagem];
    if (!valor || !valor.startsWith('data:')) {
      puladas++;
      continue;
    }

    const pasta = montarPasta(linha);
    const rotulo = `${nomeLog} id=${linha.id}`;
    try {
      const { buffer, contentType } = decodificarDataUrl(valor);
      const extensao = contentType.split('/')[1] ?? 'jpg';
      const path = `img/${pasta}/${crypto.randomUUID()}.${extensao}`;

      if (DRY_RUN) {
        console.log(`[dry-run] ${rotulo} -> subiria ${buffer.length} bytes em ${path}`);
        migradas++;
        continue;
      }

      const { error: erroUpload } = await cliente.storage.from('midia').upload(path, buffer, { contentType });
      if (erroUpload) throw erroUpload;

      const { data: urlData } = cliente.storage.from('midia').getPublicUrl(path);
      const { error: erroUpdate } = await cliente
        .from(tabela)
        .update({ [colunaImagem]: urlData.publicUrl })
        .eq('id', linha.id);
      if (erroUpdate) throw erroUpdate;

      console.log(`[migrar-imagens] ${rotulo} -> ${urlData.publicUrl}`);
      migradas++;
    } catch (e) {
      console.error(`[migrar-imagens] ${rotulo} falhou:`, e.message ?? e);
      erros++;
    }
  }

  return { migradas, puladas, erros };
}

async function main() {
  console.log(`[migrar-imagens] ${DRY_RUN ? 'DRY RUN — nenhuma escrita real' : 'rodando de verdade'}`);

  const resultados = await Promise.all([
    migrarColuna({
      tabela: 'mapa_publico',
      colunaImagem: 'imagem_data_url',
      montarPasta: () => 'mapa',
      nomeLog: 'mapa',
    }),
    migrarColuna({
      tabela: 'npcs_publico',
      colunaImagem: 'foto',
      montarPasta: (linha) => `npcs/${linha.id}`,
      nomeLog: 'npc',
    }),
    migrarColuna({
      tabela: 'characters_publico',
      colunaImagem: 'foto',
      montarPasta: (linha) => `fichas/${linha.id}`,
      nomeLog: 'ficha',
    }),
  ]);

  const total = resultados.reduce(
    (acc, r) => ({
      migradas: acc.migradas + r.migradas,
      puladas: acc.puladas + r.puladas,
      erros: acc.erros + r.erros,
    }),
    { migradas: 0, puladas: 0, erros: 0 },
  );

  console.log(
    `[migrar-imagens] fim — migradas: ${total.migradas}, já estavam ok/vazias: ${total.puladas}, erros: ${total.erros}`,
  );
  if (total.erros > 0) process.exit(1);
}

main();
