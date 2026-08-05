import { useEffect } from 'react';
import { useStore } from '../../state/store';
import { tierDeGauge } from './AlertaOverlay';

/**
 * Espelho de `AlertaOverlay.tsx` (mestre) pro jogador — só Ameaça. Ruído Narrativo passou a
 * usar o mesmo sistema visual da Sanidade (`data-ruido`, `RuidoOverlay.tsx`, compartilhado
 * pelos dois apps) — este componente escrever `data-alerta-ruido` também era bug: o jogador
 * via a vinheta ciano antiga enquanto o mestre já via o grain cinza novo, dois efeitos
 * diferentes pro mesmo gauge. Lê `sessaoPublica.ameaca` (espelhado de `sessaoPrivada` em
 * `atualizarSessaoPrivada`, store.ts) — o jogador nunca tem acesso a `sessaoPrivada` direto,
 * que não sai do Zustand local do GM. Deliberadamente NÃO um componente único parametrizado
 * com `AlertaOverlay.tsx` — pequeno o bastante pra não valer a indireção.
 */
export default function AlertaOverlayJogador() {
  const ameaca = useStore((s) => s.sessaoPublica.ameaca);
  const tierAmeaca = tierDeGauge(ameaca);

  useEffect(() => {
    document.documentElement.dataset.alertaAmeaca = String(tierAmeaca);
  }, [tierAmeaca]);

  useEffect(() => {
    return () => {
      delete document.documentElement.dataset.alertaAmeaca;
    };
  }, []);

  return <div className="alerta-ameaca-overlay" aria-hidden="true" />;
}
