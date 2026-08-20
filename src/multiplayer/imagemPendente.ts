/**
 * Detecta uma `data:` URI (base64) ainda não trocada pela URL leve do Storage
 * (`uploadImagemStorage.ts`) — usado por `mapaPublicoSync.ts`/`fichasSync.ts`/`npcsSync.ts`
 * pra nunca escrever o base64 inteiro no Postgres/Realtime (era o maior peso de egress do
 * projeto, ver comentário em `mapaPublicoSync.ts`). Enquanto a foto/imagem estiver pendente,
 * o push correspondente omite o campo (mantém o valor remoto anterior) em vez de sobrescrever
 * com o base64 — a próxima mudança (upload resolvendo pra URL) sincroniza de verdade.
 */
export const ehDataUrl = (valor: string | null): valor is string =>
  typeof valor === 'string' && valor.startsWith('data:');
