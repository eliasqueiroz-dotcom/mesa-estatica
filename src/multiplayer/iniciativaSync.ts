import { supabase } from '../lib/supabaseClient';
import { useStore } from '../state/store';
import type { EntradaIniciativa } from '../state/types';

type Cliente = NonNullable<typeof supabase>;

export interface LinhaIniciativa {
  id: string;
  participante_id: string;
  tipo: 'pc' | 'npc';
  nome: string;
  valor: number;
  posicao: number;
}

export const paraLinha = (e: EntradaIniciativa, posicao: number): LinhaIniciativa => ({
  id: e.id,
  participante_id: e.participanteId,
  tipo: e.tipo,
  nome: e.nome,
  valor: e.valor,
  posicao,
});

export const paraEntrada = (r: LinhaIniciativa): EntradaIniciativa => ({
  id: r.id,
  participanteId: r.participante_id,
  tipo: r.tipo,
  nome: r.nome,
  valor: r.valor,
});

async function buscarOrdemCompleta(cliente: Cliente): Promise<EntradaIniciativa[]> {
  const { data, error } = await cliente.from('iniciativa').select('*').order('posicao', { ascending: true });
  if (error || !data) return [];
  return (data as LinhaIniciativa[]).map(paraEntrada);
}

/**
 * Sincroniza a ordem de turno (mesa-estatica-multiplayer-completo.md §6.3, migração 0006) —
 * faltava: `sessaoPublica.modoCombate/indiceAtualTurno/rodada/condicoesCombate` já
 * sincronizavam, mas a ORDEM em si (array `iniciativa`) não tinha tabela nenhuma. `posicao`
 * é escrita explicitamente a partir do índice do array local a cada push — Postgres não tem
 * ordem implícita de linha. Reordenar/rolar/remover em qualquer combinação sempre dispara um
 * push completo (upsert de todos + delete dos que sumiram) em vez de um diff fino — mais
 * simples e a ordem inteira muda de qualquer jeito na maioria dessas ações.
 */
export function iniciarSyncIniciativa(): () => void {
  const cliente = supabase;
  if (!cliente) return () => {};

  // Contador, não boolean — ver comentário equivalente em fichasSync.ts. Aqui o risco é
  // ainda maior: upsert de N combatentes de uma vez gera N eventos Realtime separados (um
  // por linha mudada), cada um disparando seu próprio `aplicarRemoto` assíncrono concorrente.
  let aplicandoRemotoContagem = 0;
  let iniciativaAnterior = useStore.getState().iniciativa;

  const unsubscribeLocal = useStore.subscribe((state, prevState) => {
    if (aplicandoRemotoContagem > 0 || state.iniciativa === prevState.iniciativa) return;

    const linhas = state.iniciativa.map(paraLinha);
    if (linhas.length > 0) {
      cliente
        .from('iniciativa')
        .upsert(linhas)
        .then(({ error }) => {
          if (error) console.error('[iniciativaSync] upsert falhou', error.message, error.code);
        });
    }

    const idsAtuais = new Set(state.iniciativa.map((e) => e.id));
    const idsRemovidos = iniciativaAnterior.filter((e) => !idsAtuais.has(e.id)).map((e) => e.id);
    if (idsRemovidos.length > 0) {
      cliente
        .from('iniciativa')
        .delete()
        .in('id', idsRemovidos)
        .then(({ error }) => {
          if (error) console.error('[iniciativaSync] delete falhou', error.message, error.code);
        });
    }

    iniciativaAnterior = state.iniciativa;
  });

  const aplicarRemoto = async () => {
    aplicandoRemotoContagem++;
    try {
      const ordem = await buscarOrdemCompleta(cliente);
      useStore.setState({ iniciativa: ordem });
    } finally {
      iniciativaAnterior = useStore.getState().iniciativa;
      aplicandoRemotoContagem--;
    }
  };

  const canal = cliente
    .channel('iniciativa-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'iniciativa' }, () => {
      void aplicarRemoto();
    })
    .subscribe();

  return () => {
    unsubscribeLocal();
    cliente.removeChannel(canal);
  };
}
