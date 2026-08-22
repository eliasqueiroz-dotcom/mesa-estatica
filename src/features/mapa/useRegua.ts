import { useCallback, useEffect, useRef } from 'react';
import { notificarCancelamentoRegua } from '../../multiplayer/reguasSync';
import { useReguasStore, type ReguaViva } from '../../state/reguasStore';
import { usePingsStore } from '../../state/pingsStore';
import type { GradeMapa } from '../../state/types';
import { centroDaCelula, getImgRenderRect, retanguloConteudo, type Ponto } from './mapaUtils';

/** px — abaixo disso entre o pointerdown e o momento atual, ainda conta como "pode virar
 *  clique" (mesmo valor/princípio de `LIMIAR_CLIQUE` em `MapaTab.tsx`, que distingue clique de
 *  arrasto em token). Comparado em coordenadas de TELA (clientX/Y), não normalizadas — a régua
 *  em si já usa coords normalizadas à imagem, mas a distância percorrida em pixels de tela é o
 *  que a mão do usuário realmente sente. */
const LIMIAR_ARRASTO_PX = 5;

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
 * Também é dono do gesto de PING: um clique sem arrastar (nunca cruza `LIMIAR_ARRASTO_PX`) não
 * vira régua nenhuma — dispara um ping (`pingsStore.ts`) no ponto de origem. Os dois moram no
 * mesmo hook porque disputam o MESMO pointerdown em `.mapa-area`; decidir "é régua ou é ping"
 * em dois handlers separados exigiria duplicar `setPointerCapture`/guarda de alvo/normalização.
 *
 * Fluxo: pointerdown em área vazia só grava a origem (não publica nada ainda — nenhuma régua
 * fantasma de comprimento zero); pointermove só inicia a régua de verdade (com snap ao centro
 * da célula) quando a distância desde a origem ultrapassa o limiar — abaixo disso continua
 * "indeciso"; se pointerup chegar sem nunca ter cruzado o limiar, é um clique → ping. Depois de
 * iniciada, arrasta o último ponto; botão direito (ou tecla `w`) fixa um waypoint e abre novo
 * segmento — é isso que permite contornar um obstáculo desenhado no mapa; pointerup finaliza (a
 * régua começa a sumir sozinha, ver `ReguaOverlay.tsx`); `Esc` cancela e remove na hora.
 */
export function useRegua({ autorId, cor, grade, containerRef, imgRef, bloqueado }: UseReguaOpts) {
  const upsertRegua = useReguasStore((s) => s.upsertRegua);
  const removerRegua = useReguasStore((s) => s.removerRegua);
  const adicionarPing = usePingsStore((s) => s.adicionarPing);

  /** gesto em andamento mas AINDA não decidido entre régua/ping — null fora de um pointerdown. */
  const origemRef = useRef<{ snap: Ponto; clientX: number; clientY: number } | null>(null);
  /** true só depois de cruzar `LIMIAR_ARRASTO_PX` — vira uma régua de verdade. */
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
    if (medindoRef.current) {
      medindoRef.current = false;
      pontosRef.current = [];
      removerRegua(autorId);
      notificarCancelamentoRegua(autorId);
    }
    origemRef.current = null; // cancela também um clique/arrasto ainda indeciso — nada foi publicado
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

  // minimizar/trocar de app no meio de um arrasto nunca dispara pointerup na página — sem
  // isso, a régua fica "ativa" pra sempre nas telas de quem já a recebeu (expirarAntigas não
  // toca em réguas ativas, de propósito — ver reguasStore.ts). Finaliza igual a um pointerup
  // normal (mesmo fade), só que na hora em que a aba esconde, em vez de esperar a rede de
  // segurança de reguasStore.ts (que cobre os casos que nem isto alcança: crash, notebook
  // fechado abruptamente, rede caindo antes do evento disparar).
  useEffect(() => {
    const finalizarSeEscondido = () => {
      if (!document.hidden) return;
      if (medindoRef.current) {
        medindoRef.current = false;
        publicar(false);
      }
      origemRef.current = null;
    };
    document.addEventListener('visibilitychange', finalizarSeEscondido);
    window.addEventListener('pagehide', finalizarSeEscondido);
    return () => {
      document.removeEventListener('visibilitychange', finalizarSeEscondido);
      window.removeEventListener('pagehide', finalizarSeEscondido);
    };
  }, [publicar]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (bloqueado || e.button !== 0) return;
      if (e.target !== e.currentTarget) return; // não rouba clique de token/alça por cima
      const p = posicaoNormalizada(e);
      if (!p) return;
      e.preventDefault();
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      const snap = centroDaCelula(p.x, p.y, grade);
      // só grava a origem — ainda não publica régua nenhuma. Só sabemos se isto vira régua
      // (arrasto) ou ping (clique) depois de ver quanto o ponteiro se move (ou não).
      origemRef.current = { snap, clientX: e.clientX, clientY: e.clientY };
      medindoRef.current = false;
    },
    [bloqueado, grade, posicaoNormalizada],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!origemRef.current) return;
      if (!medindoRef.current) {
        const dx = e.clientX - origemRef.current.clientX;
        const dy = e.clientY - origemRef.current.clientY;
        if (Math.hypot(dx, dy) < LIMIAR_ARRASTO_PX) return; // ainda pode virar clique — espera mais
        // cruzou o limiar agora: a partir daqui É um arrasto de régua de verdade.
        medindoRef.current = true;
        pontosRef.current = [origemRef.current.snap, origemRef.current.snap];
        publicar(true);
      }
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
    if (medindoRef.current) {
      // arrasto de verdade — finaliza a régua normalmente, ela some sozinha (ReguaOverlay.tsx).
      medindoRef.current = false;
      publicar(false);
    } else if (origemRef.current) {
      // nunca cruzou o limiar de arrasto — foi um clique. Nenhuma régua chegou a ser publicada
      // (nada pra desfazer), então isto vira um ping em vez de uma "régua" de comprimento zero.
      adicionarPing({ id: crypto.randomUUID(), autorId, cor, ponto: origemRef.current.snap, criadoEm: Date.now() });
    }
    origemRef.current = null;
  }, [autorId, cor, adicionarPing, publicar]);

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
