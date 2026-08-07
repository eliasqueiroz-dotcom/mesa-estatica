import type { TipoRolagemForcada } from '../dice/registroForcados';
import { supabase } from '../lib/supabaseClient';
import { fasedAtiva } from './rolagemRemota';

/**
 * Fila forçada remota (Fase D) — GM-only, separado de `rolagemRemota.ts` de propósito
 * (mesa-estatica-multiplayer-completo.md §1, camada "código"): nenhum bundle que não seja o
 * do mestre deveria sequer conhecer o nome da Edge Function `gerenciar-fila-forcada`. A
 * própria função já recusa chamadas de quem não é GM (checa `mestres` server-side, retorna
 * 403) — este arquivo é reforço de superfície, não a barreira real.
 */
type AcaoFila = 'listar' | 'adicionar' | 'remover' | 'limpar';

async function chamarFila<T>(acao: AcaoFila, extra: Record<string, unknown> = {}): Promise<T | null> {
  if (!fasedAtiva() || !supabase) return null;
  const { data, error } = await supabase.functions.invoke<T>('gerenciar-fila-forcada', { body: { acao, ...extra } });
  if (error) {
    console.error(`[fase-d] gerenciar-fila-forcada (${acao}) falhou`, error);
    return null;
  }
  return data ?? null;
}

export interface EntradaFilaRemota {
  id: string;
  character_id: string | null;
  valores: number[];
  /** opcional na leitura: linhas criadas antes da coluna existir voltam sem ele (vira 'qualquer'). */
  tipo?: TipoRolagemForcada;
}

export const listarFilaRemota = () => chamarFila<{ fila: EntradaFilaRemota[] }>('listar');
export const adicionarFilaRemota = (characterId: string | null, valores: number[], tipo: TipoRolagemForcada) =>
  chamarFila<{ entrada: EntradaFilaRemota }>('adicionar', { character_id: characterId, valores, tipo });
export const removerFilaRemota = (id: string) => chamarFila<{ ok: true }>('remover', { id });
export const limparFilaRemota = () => chamarFila<{ ok: true }>('limpar');
