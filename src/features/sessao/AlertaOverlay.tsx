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
 * Reflexo visual do gauge de Ameaça (sessaoPrivada) na tela inteira —
 * o Ruído Narrativo agora usa o mesmo sistema visual do ruído de sanidade
 * (data-ruido via RuidoOverlay.tsx). Só escreve `data-alerta-ameaca` no <html>;
 * todo o efeito é CSS puro em styles/alerta-sessao.css.
 */
export default function AlertaOverlay() {
  const ameaca = useStore((s) => s.sessaoPrivada.ameaca);

  const tierAmeaca = tierDeGauge(ameaca);

  useEffect(() => {
    document.documentElement.dataset.alertaAmeaca = String(tierAmeaca);
  }, [tierAmeaca]);

  useEffect(() => {
    return () => {
      delete document.documentElement.dataset.alertaAmeaca;
    };
  }, []);

  return (
    <>
      <div className="alerta-ameaca-overlay" aria-hidden="true" />
    </>
  );
}
