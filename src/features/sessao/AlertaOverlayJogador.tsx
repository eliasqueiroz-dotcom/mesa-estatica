import { useEffect } from 'react';
import { useStore } from '../../state/store';
import { tierDeGauge } from './AlertaOverlay';

/**
 * Espelho de `AlertaOverlay.tsx` (mestre) pro jogador — mesma lógica visual, lendo
 * `sessaoPublica.ameaca`/`.ruidoNarrativo` (espelhados de `sessaoPrivada` em
 * `atualizarSessaoPrivada`, store.ts) em vez de `sessaoPrivada` direto — o jogador nunca tem
 * acesso a `sessaoPrivada`, que não sai do Zustand local do GM. O CSS (`alerta-sessao.css`) já
 * é global e mira `html[data-alerta-*]`, então nenhuma mudança de estilo é necessária aqui —
 * só escreve os mesmos data-attributes. Deliberadamente NÃO um componente único parametrizado
 * com `AlertaOverlay.tsx` — são ~25 linhas, mais simples como arquivo irmão (mesma decisão já
 * tomada pra `LogView`/`*Jogador` noutros lugares não se aplicou aqui por ser código pequeno
 * o bastante pra não valer a indireção). `tensao` nunca chega em `sessaoPublica` (não existe
 * nesse tipo), então não tem como vazar aqui.
 */
export default function AlertaOverlayJogador() {
  const ruidoNarrativo = useStore((s) => s.sessaoPublica.ruidoNarrativo);
  const ameaca = useStore((s) => s.sessaoPublica.ameaca);

  const tierRuido = tierDeGauge(ruidoNarrativo);
  const tierAmeaca = tierDeGauge(ameaca);

  useEffect(() => {
    document.documentElement.dataset.alertaRuido = String(tierRuido);
  }, [tierRuido]);

  useEffect(() => {
    document.documentElement.dataset.alertaAmeaca = String(tierAmeaca);
  }, [tierAmeaca]);

  useEffect(() => {
    return () => {
      delete document.documentElement.dataset.alertaRuido;
      delete document.documentElement.dataset.alertaAmeaca;
    };
  }, []);

  return (
    <>
      <div className="alerta-ameaca-overlay" aria-hidden="true" />
      <div className="alerta-ruido-narrativo-overlay" aria-hidden="true" />
    </>
  );
}
