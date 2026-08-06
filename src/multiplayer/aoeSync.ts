import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { assinarStatusCanal, desconectarCanal } from '../lib/statusMesa';
import { useAoeStore, type AoeVivo } from '../state/aoeStore';
import { criarDebouncePorChave } from './debounce';

/** Mesmo valor de `reguasSync.ts` — é feedback ao vivo de um desenho em andamento. */
const ATRASO_PUSH_MS = 80;

const CHAVE_DEBOUNCE = 'aoe';

/**
 * Sincroniza a área de efeito do mestre via Supabase Realtime **broadcast**, mesmo padrão de
 * `reguasSync.ts` (efêmero, não vale tabela/RLS/limpeza de linha órfã pra um dado que some
 * quando o mestre limpa a ferramenta).
 *
 * Assimétrico de propósito: só `AoEOverlay.tsx` (GM-only, nunca entra no bundle do jogador)
 * chama `useAoeStore.getState().definirTemplate`. Este módulo roda igual nos dois lados —
 * o jogador só nunca aciona a metade que publica, porque não tem componente que escreve no
 * store. `AoEViewOverlay.tsx` (compartilhado) só lê `useAoeStore` pra desenhar.
 *
 * `private: true` (migração 0025) — canal privado do Realtime Authorization: SEND passa a
 * exigir a policy `is_gm()` em `realtime.messages`, então mesmo achando a anon key (pública por
 * design) ninguém publica um template de AoE falso sem estar de fato vinculado como mestre.
 * Antes disso o canal era broadcast público — a UI (`AoEOverlay.tsx` GM-only) era o único
 * limite, não o servidor.
 */
export function iniciarSyncAoE(): () => void {
  const cliente = supabase;
  if (!cliente) return () => {};

  let aplicandoRemoto = false;

  const canal: RealtimeChannel = cliente
    .channel('aoe', { config: { broadcast: { self: false, ack: false }, private: true } })
    .on('broadcast', { event: 'aoe-template' }, ({ payload }) => {
      const template = (payload as { template: AoeVivo }).template;
      aplicandoRemoto = true;
      try {
        useAoeStore.getState().definirTemplate(template);
      } finally {
        aplicandoRemoto = false;
      }
    })
    .on('broadcast', { event: 'aoe-fim' }, () => {
      aplicandoRemoto = true;
      try {
        useAoeStore.getState().definirTemplate(null);
      } finally {
        aplicandoRemoto = false;
      }
    })
    .subscribe(assinarStatusCanal('aoe'));

  const enviarAgora = (_chave: string, template: AoeVivo) => {
    void canal.send({ type: 'broadcast', event: 'aoe-template', payload: { template } });
  };
  const agendarEnvio = criarDebouncePorChave<AoeVivo>(ATRASO_PUSH_MS, enviarAgora);

  let templateAnterior = useAoeStore.getState().template;
  const unsubscribeLocal = useAoeStore.subscribe((state) => {
    if (aplicandoRemoto || state.template === templateAnterior) return;
    templateAnterior = state.template;

    if (!state.template) {
      // limpou — imediato, fora do debounce (mesmo remédio de `reguasSync.ts`: sem isso, o
      // último template arrastado pode ficar pendurado na tela do jogador se o throttle
      // nunca chegar a disparar antes do "limpar").
      void canal.send({ type: 'broadcast', event: 'aoe-fim', payload: {} });
      return;
    }
    // ainda arrastando: junta a rajada de pointermove numa escrita só. Soltou o ponteiro
    // (ativa:false): envio garantido na hora.
    if (state.template.ativa) agendarEnvio(CHAVE_DEBOUNCE, state.template);
    else enviarAgora(CHAVE_DEBOUNCE, state.template);
  });

  return () => {
    unsubscribeLocal();
    desconectarCanal('aoe');
    cliente.removeChannel(canal);
  };
}
