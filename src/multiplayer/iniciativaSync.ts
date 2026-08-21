import { supabase } from '../lib/supabaseClient';
import { assinarStatusCanal, desconectarCanal } from '../lib/statusMesa';
import { useStore } from '../state/store';
import type { EntradaIniciativa } from '../state/types';
import { criarDebouncePorChave } from './debounce';

/** Mesmo valor de `fichasSync.ts`/`npcsSync.ts` — junta a rajada de reordenar/rolar/remover
 *  numa escrita só, em vez de um upsert do array inteiro a cada mudança individual. */
const ATRASO_PUSH_MS = 500;
const CHAVE_PUSH = 'iniciativa';

export interface LinhaIniciativa {
  id: string;
  participante_id: string;
  tipo: 'pc' | 'npc';
  nome: string;
  valor: number;
  posicao: number;
  /** Migração 0033 — d20 bruto e modificador de Agilidade usados na rolagem, pro tooltip
   *  "rolagem iniciativa" mostrar o valor real mesmo depois de um round-trip pelo Supabase.
   *  Nullable: linhas de antes da migração não têm esses valores. */
  d20: number | null;
  agilidade: number | null;
}

export const paraLinha = (e: EntradaIniciativa, posicao: number): LinhaIniciativa => ({
  id: e.id,
  participante_id: e.participanteId,
  tipo: e.tipo,
  nome: e.nome,
  valor: e.valor,
  posicao,
  d20: e.d20 ?? null,
  agilidade: e.agilidade ?? null,
});

export const paraEntrada = (r: LinhaIniciativa): EntradaIniciativa => ({
  id: r.id,
  participanteId: r.participante_id,
  tipo: r.tipo,
  nome: r.nome,
  valor: r.valor,
  ...(r.d20 != null ? { d20: r.d20 } : {}),
  ...(r.agilidade != null ? { agilidade: r.agilidade } : {}),
});

/**
 * Sincroniza a ordem de turno (mesa-estatica-multiplayer-completo.md §6.3, migração 0006) —
 * faltava: `sessaoPublica.modoCombate/indiceAtualTurno/rodada/condicoesCombate` já
 * sincronizavam, mas a ORDEM em si (array `iniciativa`) não tinha tabela nenhuma. `posicao`
 * é escrita explicitamente a partir do índice do array local a cada push — Postgres não tem
 * ordem implícita de linha. Reordenar/rolar/remover em qualquer combinação sempre dispara um
 * push completo (upsert de todos + delete dos que sumiram) em vez de um diff fino — mais
 * simples e a ordem inteira muda de qualquer jeito na maioria dessas ações.
 *
 * Push debounçado (não por linha — o array inteiro muda de qualquer jeito) e aplicação do
 * remoto direto do `payload` do Realtime, sem reconsultar a tabela inteira a cada evento —
 * um upsert de N combatentes gera N eventos separados, e refazer `select('*').order('posicao')`
 * em cada um multiplicava o tráfego por N à toa (mesmo anti-padrão já corrigido em
 * `mapaPublicoSync.ts`/`tokensSync.ts`).
 */
export function iniciarSyncIniciativa(): () => void {
  const cliente = supabase;
  if (!cliente) return () => {};

  // Contador, não boolean — ver comentário equivalente em fichasSync.ts. Aqui o risco é
  // ainda maior: upsert de N combatentes de uma vez gera N eventos Realtime separados (um
  // por linha mudada), cada um disparando sua própria aplicação de remoto.
  let aplicandoRemotoContagem = 0;
  let iniciativaAnterior = useStore.getState().iniciativa;
  // `posicao` não existe em `EntradaIniciativa` (a ordem do array local É a posição) — mas
  // pra reaplicar uma linha remota isolada (payload de 1 evento, não a tabela inteira) sem
  // perder a ordem entre reconexões, guarda a última `posicao` conhecida por id.
  const posicoesConhecidas = new Map<string, number>();
  const ordenarPorPosicao = (entradas: EntradaIniciativa[]): EntradaIniciativa[] =>
    [...entradas].sort((a, b) => (posicoesConhecidas.get(a.id) ?? 0) - (posicoesConhecidas.get(b.id) ?? 0));

  const executarPush = (entradas: EntradaIniciativa[]) => {
    const linhas = entradas.map(paraLinha);
    if (linhas.length > 0) {
      cliente
        .from('iniciativa')
        .upsert(linhas)
        .then(({ error }) => {
          if (error) console.error('[iniciativaSync] upsert falhou', error.message, error.code);
        });
    }

    const idsAtuais = new Set(entradas.map((e) => e.id));
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

    iniciativaAnterior = entradas;
  };

  const agendarPush = criarDebouncePorChave<EntradaIniciativa[]>(ATRASO_PUSH_MS, (_chave, entradas) => executarPush(entradas));

  // busca inicial (mesmo motivo do fix em tokensSync.ts/fichasSync.ts/mapaPublicoSync.ts) —
  // sem isso, uma sessão sem `localStorage` prévio pra essa origem (máquina nova, domínio
  // trocado — ver invariantes do ROADMAP.md) mostra a ordem de turno vazia mesmo com combate
  // em andamento no Supabase, até a próxima rolagem/reordenação recriar o array do zero. Só
  // aplica se `iniciativa` local ainda estiver vazia quando a resposta chegar — se o mestre já
  // rolou/mexeu nesse meio-tempo, a edição local vence (mesmo princípio de nunca sobrescrever
  // uma mudança em voo).
  cliente
    .from('iniciativa')
    .select('*')
    .order('posicao', { ascending: true })
    .then(({ data, error }) => {
      if (error || !data || data.length === 0) return;
      if (useStore.getState().iniciativa.length > 0) return;
      const linhas = data as LinhaIniciativa[];
      for (const linha of linhas) posicoesConhecidas.set(linha.id, linha.posicao);
      aplicandoRemotoContagem++;
      try {
        useStore.setState({ iniciativa: linhas.map(paraEntrada) });
      } finally {
        iniciativaAnterior = useStore.getState().iniciativa;
        aplicandoRemotoContagem--;
      }
    });

  const unsubscribeLocal = useStore.subscribe((state, prevState) => {
    if (aplicandoRemotoContagem > 0 || state.iniciativa === prevState.iniciativa) return;
    agendarPush(CHAVE_PUSH, state.iniciativa);
  });

  const aplicarRemoto = (payload: { eventType: string; new: object; old: object }) => {
    aplicandoRemotoContagem++;
    try {
      const s = useStore.getState();
      if (payload.eventType === 'DELETE') {
        const id = (payload.old as { id?: string }).id;
        if (!id) return;
        posicoesConhecidas.delete(id);
        useStore.setState({ iniciativa: s.iniciativa.filter((e) => e.id !== id) });
      } else {
        const linha = payload.new as LinhaIniciativa;
        posicoesConhecidas.set(linha.id, linha.posicao);
        const entrada = paraEntrada(linha);
        const existe = s.iniciativa.some((e) => e.id === entrada.id);
        const atualizada = existe
          ? s.iniciativa.map((e) => (e.id === entrada.id ? entrada : e))
          : [...s.iniciativa, entrada];
        useStore.setState({ iniciativa: ordenarPorPosicao(atualizada) });
      }
    } finally {
      iniciativaAnterior = useStore.getState().iniciativa;
      aplicandoRemotoContagem--;
    }
  };

  const canal = cliente
    .channel('iniciativa-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'iniciativa' }, (payload) => {
      aplicarRemoto(payload as { eventType: string; new: object; old: object });
    })
    .subscribe(assinarStatusCanal('iniciativa-sync'));

  return () => {
    unsubscribeLocal();
    desconectarCanal('iniciativa-sync');
    cliente.removeChannel(canal);
  };
}
