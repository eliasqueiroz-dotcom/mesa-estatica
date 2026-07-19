interface Props {
  atual: number;
  maximo: number;
  variante: 'pv' | 'sanidade';
  tier?: 0 | 1 | 2 | 3;
}

/** Barra reta e segmentada (ticks a cada 5, linha da metade marcada) — arte.md, Componentes. */
export default function BarraSegmentada({ atual, maximo, variante, tier = 0 }: Props) {
  const pct = maximo > 0 ? Math.max(0, Math.min(1, atual / maximo)) * 100 : 0;
  const ticks: number[] = [];
  for (let v = 5; v < maximo; v += 5) ticks.push((v / maximo) * 100);

  return (
    <div className="barra-segmentada" data-variante={variante} data-tier={tier}>
      <div className="barra-segmentada__preenchimento" style={{ width: `${pct}%` }} />
      {ticks.map((p) => (
        <div key={p} className="barra-segmentada__tick" style={{ left: `${p}%` }} />
      ))}
      <div className="barra-segmentada__metade" />
    </div>
  );
}
