import { useCallback, useEffect, useRef } from 'react';
import { notificarCancelamentoRegua } from '../../multiplayer/reguasSync';
import { useReguasStore, type ReguaViva } from '../../state/reguasStore';
import type { GradeMapa } from '../../state/types';
import { centroDaCelula, getImgRenderRect, retanguloConteudo, type Ponto } from './mapaUtils';

interface UseReguaOpts {
  /** Ficha.id de quem mede, ou `'mestre'` pra o GM sem personagem próprio. */
  autorId: string;
  cor: string;
  grade: GradeMapa;
  containerRef: React.RefObject<HTMLElement | null>;
  imgRef: React.RefObject<HTMLImageElement | null>;
  /** true enquanto outra interação já está em andamento (arrasto de token, mover/redimensionar
   *  grid) — a régua nunca assume o pointerdown nesse caso. */
  bloqueado: boolean;
}

/**
 * Interação da régua de medição — compartilhada entre `MapaTab` (GM) e `MapaJogadorView`
 * (jogador), mesmo padrão de `useIniciativa.ts` centralizando lógica reusada nos dois lados.
 *
 * Fluxo: pointerdown em área vazia inicia a medição com snap ao centro da célula; pointermove
 * arrasta o último ponto; botão direito (ou tecla `w`) fixa um waypoint e abre novo segmento —
 * é isso que permite contornar um obstáculo desenhado no mapa; pointerup finaliza (a régua
 * começa a sumir sozinha, ver `ReguaOverlay.tsx`); `Esc` cancela e remove na hora.
 */
export function useRegua({ autorId, cor, grade, containerRef, imgRef, bloqueado }: UseReguaOpts) {
  const upsertRegua = useReguasStore((s) => s.upsertRegua);
  const removerRegua = useReguasStore((s) => s.removerRegua);

  const medindoRef = useRef(false);
  const pontosRef = useRef<Ponto[]>([]);

  const posicaoNormalizada = useCallback(
    (e: { clientX: number; clientY: number }): Ponto | null => {
      const container = containerRef.current;
      if (!container) return null;
      const rect = retanguloConteudo(container);
      if (rect.width <= 0 || rect.height <= 0) return null;
      const imgEl = imgRef.current;
      if (imgEl && imgEl.naturalWidth > 0 && imgEl.naturalHeight > 0) {
        const imgR = getImgRenderRect(rect.width, rect.height, imgEl.naturalWidth, imgEl.naturalHeight);
        return {
          x: (e.clientX - rect.left - imgR.offsetX) / imgR.renderW,
          y: (e.clientY - rect.top - imgR.offsetY) / imgR.renderH,
        };
      }
      return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
    },
    [containerRef, imgRef],
  );

  const publicar = useCallback(
    (ativa: boolean) => {
      const regua: ReguaViva = { id: autorId, autorId, cor, pontos: pontosRef.current, atualizadaEm: Date.now(), ativa };
      upsertRegua(regua);
    },
    [autorId, cor, upsertRegua],
  );

  // remoção explícita e imediata (Esc) — diferente do fim normal (pointerup), que só marca
  // `ativa: false` e deixa o fade natural cuidar do resto (ver ReguaOverlay.tsx); por isso avisa
  // o sync direto, em vez de esperar o próximo diff do store.
  const cancelar = useCallback(() => {
    if (!medindoRef.current) return;
    medindoRef.current = false;
    pontosRef.current = [];
    removerRegua(autorId);
    notificarCancelamentoRegua(autorId);
  }, [autorId, removerRegua]);

  const fixarWaypoint = useCallback(() => {
    if (!medindoRef.current) return;
    const pontos = pontosRef.current;
    pontosRef.current = [...pontos, pontos[pontos.length - 1]];
    publicar(true);
  }, [publicar]);

  // tecla 'w' / Esc funcionam mesmo sem o container ter foco — ouvir na window é o mesmo
  // remédio usado em CombatOverlay.tsx pro arrasto do painel (listener sempre ligado, guarda
  // por ref interna em vez de religar o efeito a cada pointerdown).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!medindoRef.current) return;
      if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        fixarWaypoint();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelar();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fixarWaypoint, cancelar]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (bloqueado || e.button !== 0) return;
      if (e.target !== e.currentTarget) return; // não rouba clique de token/alça por cima
      const p = posicaoNormalizada(e);
      if (!p) return;
      e.preventDefault();
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      const snap = centroDaCelula(p.x, p.y, grade);
      medindoRef.current = true;
      pontosRef.current = [snap, snap];
      publicar(true);
    },
    [bloqueado, grade, posicaoNormalizada, publicar],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!medindoRef.current) return;
      const p = posicaoNormalizada(e);
      if (!p) return;
      const snap = centroDaCelula(p.x, p.y, grade);
      const pontos = pontosRef.current;
      pontos[pontos.length - 1] = snap;
      publicar(true);
    },
    [grade, posicaoNormalizada, publicar],
  );

  const onPointerUp = useCallback(() => {
    if (!medindoRef.current) return;
    medindoRef.current = false;
    publicar(false);
  }, [publicar]);

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!medindoRef.current) return;
      e.preventDefault();
      fixarWaypoint();
    },
    [fixarWaypoint],
  );

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onContextMenu };
}
