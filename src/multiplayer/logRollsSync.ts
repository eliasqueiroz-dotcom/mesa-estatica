import type { EntradaLog, EntradaRoll, TipoLog } from '../state/types';
import { supabase } from '../lib/supabaseClient';
import { assinarStatusCanal, desconectarCanal } from '../lib/statusMesa';
import { useStore } from '../state/store';

interface LinhaLog {
  id: string;
  tipo: string;
  personagem_id: string | null;
  texto: string;
  criado_em: string;
  visibilidade: 'publica' | 'privada';
  rodada: number | null;
}

interface LinhaRoll {
  id: string;
  origem: string;
  personagem_id: string | null;
  formula: string;
  total: number;
  bruto: number;
  visibilidade: 'publica' | 'privada';
  criado_em: string;
}

const paraLinhaLog = (e: EntradaLog): LinhaLog => ({
  id: e.id,
  tipo: e.tipo,
  personagem_id: e.personagemId,
  texto: e.texto,
  criado_em: e.timestamp,
  visibilidade: e.visibilidade ?? 'publica',
  rodada: e.rodada ?? null,
});

const paraEntradaLog = (r: LinhaLog): EntradaLog => ({
  id: r.id,
  timestamp: r.criado_em,
  tipo: r.tipo as TipoLog,
  personagemId: r.personagem_id,
  texto: r.texto,
  visibilidade: r.visibilidade,
  rodada: r.rodada ?? undefined,
});

const paraLinhaRoll = (e: EntradaRoll): LinhaRoll => ({
  id: e.id,
  origem: e.origem,
  personagem_id: e.personagemId,
  formula: e.formula,
  total: e.total,
  bruto: e.bruto,
  visibilidade: e.visibilidade,
  criado_em: e.timestamp,
});

const paraEntradaRoll = (r: LinhaRoll): EntradaRoll => ({
  id: r.id,
  timestamp: r.criado_em,
  origem: r.origem,
  personagemId: r.personagem_id,
  formula: r.formula,
  total: r.total,
  bruto: r.bruto,
  visibilidade: r.visibilidade,
});

/**
 * Sincroniza `log`/`rollsLog` — único módulo de sync verdadeiramente SIMÉTRICO do projeto
 * (mesmo padrão de `tokensSync.ts`, não os módulos GM-only-push como `fichasSync.ts`):
 * tanto o mestre quanto qualquer jogador chamam `registrarLog`/`registrarRoll` no mesmo
 * store compartilhado, então os dois lados precisam empurrar E puxar. Sem debounce —
 * entrada de log/rolagem é evento discreto (uma rolagem = uma escrita), não rajada como
 * digitar/arrastar.
 *
 * `log_publico`/`rolls_publicas` são tabelas NOVAS, de propósito separadas de `rolls_log`
 * (migração 0005, que pertence ao sistema de rolagem forçada — Fase C/D, sem coluna de
 * visibilidade, sem RLS por dono). Ver 0009_log_rolls_publicos.sql.
 */
export function iniciarSyncLogRolls(): () => void {
  const cliente = supabase;
  if (!cliente) return () => {};

  let aplicandoRemoto = false;
  let logAnterior = useStore.getState().log;
  let rollsAnterior = useStore.getState().rollsLog;

  // busca inicial — mais novo primeiro, pra já bater com a ordem local (registrarLog/
  // registrarRoll fazem prepend). `aplicandoRemoto` evita ecoar de volta pro servidor.
  Promise.all([
    cliente.from('log_publico').select('*').order('criado_em', { ascending: false }),
    cliente.from('rolls_publicas').select('*').order('criado_em', { ascending: false }),
  ]).then(([logRes, rollsRes]) => {
    if (!logRes.data && !rollsRes.data) return;
    aplicandoRemoto = true;
    try {
      useStore.setState((s) => ({
        log: logRes.data ? (logRes.data as LinhaLog[]).map(paraEntradaLog) : s.log,
        rollsLog: rollsRes.data ? (rollsRes.data as LinhaRoll[]).map(paraEntradaRoll) : s.rollsLog,
      }));
    } finally {
      logAnterior = useStore.getState().log;
      rollsAnterior = useStore.getState().rollsLog;
      aplicandoRemoto = false;
    }
  });

  const unsubscribeLocal = useStore.subscribe((state, prevState) => {
    if (aplicandoRemoto) return;

    if (state.log !== prevState.log) {
      if (state.log.length === 0 && logAnterior.length > 0) {
        // limparLog — apaga tudo no servidor também (delete sem filtro exige uma condição
        // sempre-verdadeira no PostgREST).
        cliente
          .from('log_publico')
          .delete()
          .not('id', 'is', null)
          .then(({ error }) => {
            if (error) console.error('[logRollsSync] limpar log falhou', error);
          });
      } else {
        const idsAnteriores = new Set(logAnterior.map((e) => e.id));
        for (const entrada of state.log) {
          if (!idsAnteriores.has(entrada.id)) {
            cliente
              .from('log_publico')
              .insert(paraLinhaLog(entrada))
              .then(({ error }) => {
                if (error) console.error('[logRollsSync] push de log falhou', error);
              });
          }
        }
      }
      logAnterior = state.log;
    }

    if (state.rollsLog !== prevState.rollsLog) {
      const anterioresPorId = new Map(rollsAnterior.map((r) => [r.id, r]));
      for (const roll of state.rollsLog) {
        const anterior = anterioresPorId.get(roll.id);
        if (!anterior) {
          cliente
            .from('rolls_publicas')
            .insert(paraLinhaRoll(roll))
            .then(({ error }) => {
              if (error) console.error('[logRollsSync] push de rolagem falhou', error);
            });
        } else if (anterior.visibilidade !== roll.visibilidade) {
          cliente
            .from('rolls_publicas')
            .update({ visibilidade: roll.visibilidade })
            .eq('id', roll.id)
            .then(({ error }) => {
              if (error) console.error('[logRollsSync] revelar rolagem falhou', error);
            });
        }
      }
      rollsAnterior = state.rollsLog;
    }
  });

  const canalLog = cliente
    .channel('log-publico-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'log_publico' }, (payload) => {
      aplicandoRemoto = true;
      try {
        const s = useStore.getState();
        if (payload.eventType === 'DELETE') {
          const idRemovido = (payload.old as { id: string }).id;
          useStore.setState({ log: s.log.filter((e) => e.id !== idRemovido) });
        } else {
          const entrada = paraEntradaLog(payload.new as LinhaLog);
          const existe = s.log.some((e) => e.id === entrada.id);
          const log = existe ? s.log.map((e) => (e.id === entrada.id ? entrada : e)) : [entrada, ...s.log];
          useStore.setState({ log });
        }
      } finally {
        logAnterior = useStore.getState().log;
        aplicandoRemoto = false;
      }
    })
    .subscribe(assinarStatusCanal('log-publico-sync'));

  const canalRolls = cliente
    .channel('rolls-publicas-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rolls_publicas' }, (payload) => {
      aplicandoRemoto = true;
      try {
        const s = useStore.getState();
        if (payload.eventType === 'DELETE') {
          const idRemovido = (payload.old as { id: string }).id;
          useStore.setState({ rollsLog: s.rollsLog.filter((r) => r.id !== idRemovido) });
        } else {
          const roll = paraEntradaRoll(payload.new as LinhaRoll);
          const existe = s.rollsLog.some((r) => r.id === roll.id);
          const rollsLog = existe ? s.rollsLog.map((r) => (r.id === roll.id ? roll : r)) : [roll, ...s.rollsLog];
          useStore.setState({ rollsLog });
        }
      } finally {
        rollsAnterior = useStore.getState().rollsLog;
        aplicandoRemoto = false;
      }
    })
    .subscribe(assinarStatusCanal('rolls-publicas-sync'));

  return () => {
    unsubscribeLocal();
    desconectarCanal('log-publico-sync');
    desconectarCanal('rolls-publicas-sync');
    cliente.removeChannel(canalLog);
    cliente.removeChannel(canalRolls);
  };
}
