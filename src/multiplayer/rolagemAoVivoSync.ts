import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { assinarStatusCanal, desconectarCanal } from '../lib/statusMesa';
import { useRolagemAoVivoStore, type RolagemAoVivo } from '../state/rolagemAoVivoStore';
import { ehRolagemAoVivo } from './validarPayload';

/**
 * Sincroniza rolagens ao vivo via Supabase Realtime **broadcast**, mesmo padrão de
 * `pingSync.ts`: efêmero (não vale tabela/RLS pra um dado que já foi pro log em texto),
 * simétrico na autorização (qualquer autenticado publica e recebe — sem `is_gm()`), sem
 * debounce (uma rolagem = um evento discreto, não rajada).
 *
 * Assimétrico na prática, não na autorização: só `DadosTabJogador.tsx`/`QuickRollOverlayJogador.tsx`
 * chamam `useRolagemAoVivoStore.getState().definirAtual` (ver comentário no próprio store) — o
 * mestre nunca escreve nele, então este módulo só empurra pro servidor quando quem rodou é um
 * jogador. `RolagemAoVivoPlayer.tsx` (compartilhado) só lê o store pra animar e mostrar quem
 * está rolando.
 *
 * `private: true` (mesmo padrão pós-migração 0025/0029) — canal privado do Realtime
 * Authorization, autorizado pela migração 0030.
 */
export function iniciarSyncRolagemAoVivo(): () => void {
  const cliente = supabase;
  if (!cliente) return () => {};

  let aplicandoRemoto = false;

  const canal: RealtimeChannel = cliente
    .channel('dados', { config: { broadcast: { self: false, ack: false }, private: true } })
    .on('broadcast', { event: 'rolagem' }, ({ payload }) => {
      const rolagem = (payload as { rolagem?: unknown }).rolagem;
      if (!ehRolagemAoVivo(rolagem)) {
        console.warn('[rolagemAoVivoSync] payload de rolagem com shape invalido, descartado', payload);
        return;
      }
      aplicandoRemoto = true;
      try {
        useRolagemAoVivoStore.getState().definirAtual(rolagem);
      } finally {
        aplicandoRemoto = false;
      }
    })
    .subscribe(assinarStatusCanal('dados'));

  let anterior = useRolagemAoVivoStore.getState().atual;
  const unsubscribeLocal = useRolagemAoVivoStore.subscribe((state) => {
    if (aplicandoRemoto || state.atual === anterior) return;
    anterior = state.atual;
    if (!state.atual) return;
    const rolagem: RolagemAoVivo = state.atual;
    void canal.send({ type: 'broadcast', event: 'rolagem', payload: { rolagem } });
  });

  return () => {
    unsubscribeLocal();
    desconectarCanal('dados');
    cliente.removeChannel(canal);
  };
}
