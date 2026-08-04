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

  const entradas = useMemo(
    () => filtrarLogDeCombate(log, filtroParticipante || null).slice(-40).reverse(),
    [log, filtroParticipante],
  );

  return (
    <div>
      <select
        value={filtroParticipante}
        onChange={(e) => setFiltroParticipante(e.target.value)}
        style={{ fontSize: 11, marginBottom: '0.4rem', width: '100%' }}
      >
        <option value="">todos os combatentes</option>
        {iniciativa.map((e) => (
          <option key={e.participanteId} value={e.participanteId}>
            {e.nome}
          </option>
        ))}
      </select>

      {entradas.length === 0 ? (
        <p className="vazio" style={{ fontSize: 11 }}>nada de combate no log ainda.</p>
      ) : (
        <div className="mono" style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
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
