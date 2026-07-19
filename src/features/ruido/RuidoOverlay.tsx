import { useEffect, useRef } from 'react';
import { calcularSanidadeMaxima, calcularTierRuido } from '../../rules/derivados';
import { useStore } from '../../state/store';

const DURACAO_BURST_MS = 1500;

/**
 * Elemento de assinatura da direção de arte (arte.md): camada global de estática que responde à
 * Sanidade da ficha ativa. Só escreve `data-ruido`/`data-ruido-burst` no `<html>` — todo o efeito
 * visual (grain, scanlines, chroma aberration, glitch, vinheta) é CSS puro em `styles/ruido.css`,
 * então não há rAF nem repaint por JS aqui, só um `<div>` fixo `pointer-events: none`.
 *
 * O burst (`ultimoBurstRuidoEm`) dispara em qualquer queda de Sanidade (`ajustarSanidadeAtual`) e
 * ao rolar na tabela de Surto (`RoladorSurto`) — reação instantânea no momento do dado/da queda,
 * não só quando o Surto mecânico é acionado.
 */
export default function RuidoOverlay() {
  const fichaAtiva = useStore((s) => s.fichas.find((f) => f.id === s.fichaAtivaId) ?? null);
  const ultimoBurstRuidoEm = useStore((s) => s.ultimoBurstRuidoEm);
  const burstTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tier = fichaAtiva
    ? calcularTierRuido(fichaAtiva.sanidadeAtual, calcularSanidadeMaxima(fichaAtiva.atributos.vontade))
    : 0;

  useEffect(() => {
    document.documentElement.dataset.ruido = String(tier);
  }, [tier]);

  useEffect(() => {
    if (ultimoBurstRuidoEm === null) return;
    document.documentElement.dataset.ruidoBurst = 'true';
    burstTimeoutRef.current = setTimeout(() => {
      delete document.documentElement.dataset.ruidoBurst;
    }, DURACAO_BURST_MS);
    return () => {
      if (burstTimeoutRef.current) clearTimeout(burstTimeoutRef.current);
    };
  }, [ultimoBurstRuidoEm]);

  useEffect(() => {
    return () => {
      delete document.documentElement.dataset.ruido;
      delete document.documentElement.dataset.ruidoBurst;
    };
  }, []);

  return <div className="ruido-overlay" aria-hidden="true" />;
}
