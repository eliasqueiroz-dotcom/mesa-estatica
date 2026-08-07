import { useCallback, useEffect, useState } from 'react';
import {
  assinar,
  enfileirarForcado,
  filaAtual,
  limparForcados,
  pedirEstado,
  removerForcado,
} from '../../dice/forcarRolagem';
import type { TipoRolagemForcada } from '../../dice/registroForcados';
import { adicionarFilaRemota, limparFilaRemota, listarFilaRemota, removerFilaRemota } from '../../multiplayer/filaRemota';
import { fasedAtiva } from '../../multiplayer/rolagemRemota';
import { useStore } from '../../state/store';

export interface EntradaFila {
  id: string;
  /** null = qualquer personagem (casa com todos). */
  personagemId: string | null;
  personagemNome: string;
  valores: number[];
  /** categoria de rolagem que pode consumir esta entrada ('qualquer' casa com todas). */
  tipo: TipoRolagemForcada;
}

interface FilaForcada {
  fila: EntradaFila[];
  /** true = Fase D ativa (fila em `forced_queue` via Edge Function); false = local (BroadcastChannel). */
  remoto: boolean;
  adicionar: (valores: number[], personagemId: string | null, tipo: TipoRolagemForcada) => void;
  remover: (id: string) => void;
  limpar: () => void;
}

/**
 * Unifica a fila de rolagem forçada local (BroadcastChannel, sempre disponível) com a remota
 * (Fase D — mesa-estatica-multiplayer-completo.md §11, atrás de `VITE_FASE_D_ROLAGEM_REMOTA`).
 * `ControlPanel.tsx` não precisa saber qual das duas está em uso — só consome `fila`/`adicionar`/
 * `remover`/`limpar`, sempre no mesmo shape.
 *
 * A remota nunca tem Realtime (de propósito — `forced_queue` não expõe nada ao cliente, nem
 * mudança de linha; ver §13), então cada ação refaz um `listar` explícito pra atualizar a tela.
 */
export function useFilaForcada(): FilaForcada {
  const fichas = useStore((s) => s.fichas);
  const npcs = useStore((s) => s.npcs);
  const remoto = fasedAtiva();

  const nomeDoAlvo = useCallback(
    (personagemId: string | null) => {
      if (personagemId === null) return 'qualquer';
      const ficha = fichas.find((f) => f.id === personagemId);
      if (ficha) return ficha.nome || 'sem nome';
      const npc = npcs.find((n) => n.id === personagemId);
      return npc?.nome || 'sem nome';
    },
    [fichas, npcs],
  );

  const [filaLocal, setFilaLocal] = useState<EntradaFila[]>(filaAtual);
  const [filaRemota, setFilaRemota] = useState<EntradaFila[]>([]);

  useEffect(() => {
    if (remoto) return;
    const desassinar = assinar(setFilaLocal);
    pedirEstado();
    return desassinar;
  }, [remoto]);

  const atualizarFilaRemota = useCallback(() => {
    listarFilaRemota().then((r) => {
      setFilaRemota(
        (r?.fila ?? []).map((e) => ({
          id: e.id,
          personagemId: e.character_id,
          personagemNome: nomeDoAlvo(e.character_id),
          valores: e.valores,
          tipo: e.tipo ?? 'qualquer',
        })),
      );
    });
  }, [nomeDoAlvo]);

  useEffect(() => {
    if (remoto) atualizarFilaRemota();
  }, [remoto, atualizarFilaRemota]);

  const adicionar = useCallback(
    (valores: number[], personagemId: string | null, tipo: TipoRolagemForcada) => {
      if (remoto) {
        void adicionarFilaRemota(personagemId, valores, tipo).then(atualizarFilaRemota);
      } else {
        enfileirarForcado(valores, personagemId, nomeDoAlvo(personagemId), tipo);
      }
    },
    [remoto, atualizarFilaRemota, nomeDoAlvo],
  );

  const remover = useCallback(
    (id: string) => {
      if (remoto) {
        void removerFilaRemota(id).then(atualizarFilaRemota);
      } else {
        removerForcado(id);
      }
    },
    [remoto, atualizarFilaRemota],
  );

  const limpar = useCallback(() => {
    if (remoto) {
      void limparFilaRemota().then(atualizarFilaRemota);
    } else {
      limparForcados();
    }
  }, [remoto, atualizarFilaRemota]);

  return { fila: remoto ? filaRemota : filaLocal, remoto, adicionar, remover, limpar };
}
