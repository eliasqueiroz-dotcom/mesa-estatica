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

/**
 * Fase 6 (Parte IV §6.5) — versão do jogador: sempre tenta o servidor, sem o gate de
 * `VITE_FASE_D_ROLAGEM_REMOTA`. Diferente do mestre, o jogador não tem `#controle`/
 * BroadcastChannel — sem o servidor, não existe "cair pro caminho local" que faça sentido
 * pra rolagem forçada (só honesto de verdade). Se a chamada falhar, quem chamou cai pra
 * `Math.random` puro (nunca trava a rolagem por rede fora, mas também nunca é forçável
 * nesse caminho de erro).
 */
export async function resolverRolagemJogador(termos: Termo[], personagemId: string | null): Promise<number[] | null> {
  if (!supabase) return null;
  const { data: sessao } = await supabase.auth.getSession();
  if (!sessao.session) return null;

  const { data, error } = await supabase.functions.invoke<{ valores: number[] }>('resolver-rolagem', {
    body: { character_id: personagemId, termos },
  });
  if (error || !data) {
    console.error('[jogador] resolver-rolagem falhou, rolando honesto localmente', error);
    return null;
  }
  return data.valores;
}
