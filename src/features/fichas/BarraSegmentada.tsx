interface Props {
  atual: number;
  maximo: number;
  variante: 'pv' | 'sanidade' | 'gauge';
  tier?: 0 | 1 | 2 | 3;
  /** intervalo dos ticks — 5 pra PV/Sanidade (regras.md), maior faz sentido pra gauges 0-100. */
  passoTick?: number;
  /** sobrepõe a cor de preenchimento (ex.: corPv por faixa crítica/média/saudável) — sem isso, usa a cor padrão da variante no CSS. */
  corPreenchimento?: string;
  /** altura compacta pra uso dentro de linhas de lista (rastreador de iniciativa). */
  compacta?: boolean;
}

/** Barra reta e segmentada (ticks a cada passoTick, linha da metade marcada) — arte.md, Componentes. */
export default function BarraSegmentada({ atual, maximo, variante, tier = 0, passoTick = 5, corPreenchimento, compacta = false }: Props) {
  const pct = maximo > 0 ? Math.max(0, Math.min(1, atual / maximo)) * 100 : 0;
  const ticks: number[] = [];
  for (let v = passoTick; v < maximo; v += passoTick) ticks.push((v / maximo) * 100);

  return (
    <div className="barra-segmentada" data-variante={variante} data-tier={tier} style={compacta ? { height: 7, marginTop: 0 } : undefined}>
      <div className="barra-segmentada__preenchimento" style={{ width: `${pct}%`, ...(corPreenchimento ? { background: corPreenchimento } : {}) }} />
      {ticks.map((p) => (
        <div key={p} className="barra-segmentada__tick" style={{ left: `${p}%` }} />
      ))}
      <div className="barra-segmentada__metade" />
    </div>
  );
}
