import { useEffect } from 'react';
import { useStore } from '../../state/store';

/** Tier dos gauges de "Estado da mesa" — não é regra de jogo (rules/), é leitura direta de um
 *  valor que o mestre ajusta na hora; por isso fica aqui, não em src/rules/. Exportado porque
 *  EstadoMesaSection.tsx reforça o mesmo tier localmente na BarraSegmentada de cada gauge. */
export function tierDeGauge(valor: number): 0 | 1 | 2 | 3 {
  if (valor >= 75) return 3;
  if (valor >= 50) return 2;
  if (valor >= 25) return 1;
  return 0;
}

/**
 * Reflexo visual dos gauges de Ruído narrativo e Ameaça (sessaoPrivada) na tela inteira —
 * efeito deliberadamente separado do sistema de ruído ligado à Sanidade (features/ruido/
 * RuidoOverlay.tsx): arte.md limita a 2 "momentos ousados" (Sanidade+ruído, dados 3D), então
 * este fica mais discreto e com identidade própria (cor/forma), não reaproveita `data-ruido`.
 * Tensão não participa (decisão do usuário) — fica só como indicador de ritmo na aba Sessão.
 * Só escreve `data-alerta-*` no <html>; todo o efeito é CSS puro em styles/alerta-sessao.css.
 */
export default function AlertaOverlay() {
  const ruidoNarrativo = useStore((s) => s.sessaoPrivada.ruidoNarrativo);
  const ameaca = useStore((s) => s.sessaoPrivada.ameaca);

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
