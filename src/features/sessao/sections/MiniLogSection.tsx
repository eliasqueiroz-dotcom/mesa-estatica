import { useStore } from '../../../state/store';

const N = 5;

/** §7 — Mini log [Público]: view derivada dos últimos N registros do log — não é campo próprio. */
export default function MiniLogSection() {
  const log = useStore((s) => s.log);
  const ultimos = log.slice(0, N);

  return (
    <section className="secao">
      <h3>mini log</h3>
      {ultimos.length === 0 ? (
        <p className="vazio">sem registros. sinal limpo.</p>
      ) : (
        <div className="mono" style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {ultimos.map((e) => (
            <div key={e.id}>
              [{new Date(e.timestamp).toLocaleTimeString()}] {e.texto}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
