import { useMemo, useState } from 'react';
import { filtrarLogDeCombate } from '../../rules/combate';
import { useStore } from '../../state/store';
import type { EntradaIniciativa } from '../../state/types';

interface Props {
  iniciativa: EntradaIniciativa[];
}

/**
 * Recorte do log narrativo só com o que é "de combate" (dano, iniciativa, teste) — pra não
 * precisar trocar de aba (Log) no meio de uma luta pra ver o que já rolou. `LogView.tsx` (aba
 * Log) continua sendo o log completo com todos os filtros; isso aqui é um atalho de leitura
 * rápida, sem "limpar" nem revelar rolagem privada.
 */
export default function CombatLogView({ iniciativa }: Props) {
  const log = useStore((s) => s.log);
  const [filtroParticipante, setFiltroParticipante] = useState('');
  const [filtroRodada, setFiltroRodada] = useState('');

  // rodadas distintas presentes no log de combate (só tipo, sem filtro de participante/rodada
  // ainda) — pra popular o select sem oferecer opções que não existem no histórico atual.
  const rodadasDisponiveis = useMemo(() => {
    const vistas = new Set<number>();
    for (const e of filtrarLogDeCombate(log)) if (e.rodada != null) vistas.add(e.rodada);
    return [...vistas].sort((a, b) => a - b);
  }, [log]);

  const entradas = useMemo(
    () =>
      filtrarLogDeCombate(log, filtroParticipante || null, filtroRodada ? Number(filtroRodada) : null)
        .slice(0, 40)
        .reverse(),
    [log, filtroParticipante, filtroRodada],
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.4rem' }}>
        <select
          value={filtroParticipante}
          onChange={(e) => setFiltroParticipante(e.target.value)}
          style={{ fontSize: 12, flex: 1, minWidth: 0 }}
        >
          <option value="">todos os combatentes</option>
          {iniciativa.map((e) => (
            <option key={e.participanteId} value={e.participanteId}>
              {e.nome}
            </option>
          ))}
        </select>
        <select
          value={filtroRodada}
          onChange={(e) => setFiltroRodada(e.target.value)}
          style={{ fontSize: 12, flexShrink: 0 }}
        >
          <option value="">todas as rodadas</option>
          {rodadasDisponiveis.map((r) => (
            <option key={r} value={r}>
              rodada {r}
            </option>
          ))}
        </select>
      </div>

      {entradas.length === 0 ? (
        <p className="vazio" style={{ fontSize: 12 }}>nada de combate no log ainda.</p>
      ) : (
        <div className="mono" style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {entradas.map((e) => (
            <div key={e.id}>
              [{new Date(e.timestamp).toLocaleTimeString()}] {e.texto}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
