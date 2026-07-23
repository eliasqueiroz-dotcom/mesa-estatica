import { supabase } from '../lib/supabaseClient';

/**
 * Fase D (mesa-estatica-multiplayer-completo.md §11): desligado por padrão — precisa de
 * `VITE_FASE_D_ROLAGEM_REMOTA=true` explícito. Enquanto desligado, `useDiceBox.ts` e
 * `ControlPanel.tsx` continuam 100% no caminho local (física + BroadcastChannel),
 * validado e em uso pra sessão de 25/07. NÃO testado com dois aparelhos reais ainda —
 * não ativar em produção antes desse teste.
 */
export const fasedAtiva = (): boolean => supabase !== null && import.meta.env.VITE_FASE_D_ROLAGEM_REMOTA === 'true';

interface Termo {
  qty: number;
  sides: number;
}

/** Chama resolver-rolagem. Retorna null se a Fase D estiver desligada ou a chamada falhar
 *  (o chamador deve cair pro caminho local nesse caso — nunca travar a rolagem por rede fora). */
export async function resolverRolagemRemota(termos: Termo[], personagemId: string | null): Promise<number[] | null> {
  if (!fasedAtiva() || !supabase) return null;
  const { data: sessao } = await supabase.auth.getSession();
  if (!sessao.session) return null;

  const { data, error } = await supabase.functions.invoke<{ valores: number[] }>('resolver-rolagem', {
    body: { character_id: personagemId, termos },
  });
  if (error || !data) {
    console.error('[fase-d] resolver-rolagem falhou, caindo pro caminho local', error);
    return null;
  }
  return data.valores;
}

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
}

export const listarFilaRemota = () => chamarFila<{ fila: EntradaFilaRemota[] }>('listar');
export const adicionarFilaRemota = (characterId: string | null, valores: number[]) =>
  chamarFila<{ entrada: EntradaFilaRemota }>('adicionar', { character_id: characterId, valores });
export const removerFilaRemota = (id: string) => chamarFila<{ ok: true }>('remover', { id });
export const limparFilaRemota = () => chamarFila<{ ok: true }>('limpar');
