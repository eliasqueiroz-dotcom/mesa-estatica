import { useEffect, useRef } from 'react';
import { calcularSanidadeMaxima, calcularTierRuido } from '../../rules/derivados';
import { useStore } from '../../state/store';

const DURACAO_BURST_MS = 1500;

/** Nomes dos tiers do sistema de ruído — usado aqui e no indicador compacto (DestaqueSuperior)
 *  e no badge da ficha (AtributosDerivadosSection), pra não ter dois nomes divergentes. O
 *  desambiguador "ruído sanidade" (vs. o gauge "Ruído narrativo", correcoes-parte2.md item 5)
 *  já fica no rótulo/prefixo de quem usa este mapa — o valor do tier fica curto, senão o tier 2
 *  duplicava ("ruído sanidade: ruído sanidade"). */
export const NOME_TIER_RUIDO: Record<0 | 1 | 2 | 3, string> = {
  0: 'limpo',
  1: 'interferência',
  2: 'ruído',
  3: 'colapso',
};

/** Tier de ruído da ficha ativa — mesmo cálculo usado pelo overlay e pelo indicador compacto. */
export function useTierRuidoFichaAtiva(): 0 | 1 | 2 | 3 {
  const fichaAtiva = useStore((s) => s.fichas.find((f) => f.id === s.fichaAtivaId) ?? null);
  return fichaAtiva
    ? calcularTierRuido(fichaAtiva.sanidadeAtual, calcularSanidadeMaxima(fichaAtiva.atributos.vontade))
    : 0;
}

/**
 * Elemento de assinatura da direção de arte (arte.md): camada global de estática que responde à
 * Sanidade da ficha ativa. Só escreve `data-ruido`/`data-ruido-burst` no `<html>` — todo o efeito
 * visual (grain, scanlines, vinheta, chroma aberration, glitch) é CSS puro em `styles/ruido.css`,
 * então não há rAF nem repaint por JS aqui, só um `<div>` fixo `pointer-events: none`. O tier 3
 * distorce texto de propósito ("pode incomodar de leve — é o ponto", arte.md); o indicador
 * compacto "ruído sanidade: X" (DestaqueSuperior.tsx) dá uma leitura limpa em paralelo.
 *
 * O burst (`ultimoBurstRuidoEm`) dispara em qualquer queda de Sanidade (`ajustarSanidadeAtual`) e
 * ao rolar na tabela de Surto (`RoladorSurto`) — reação instantânea no momento do dado/da queda,
 * não só quando o Surto mecânico é acionado.
 */
export default function RuidoOverlay() {
  const ultimoBurstRuidoEm = useStore((s) => s.ultimoBurstRuidoEm);
  const burstTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tier = useTierRuidoFichaAtiva();

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
