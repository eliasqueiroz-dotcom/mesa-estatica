import { useEffect, useState } from 'react';
import { useStore } from '../../../state/store';
import BarraSegmentada from '../../fichas/BarraSegmentada';

function formatarDuracao(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
}

/** §3 — Estado da mesa [Privado]: indicadores de ritmo — mostrar a jogadores seria metagame. */
export default function EstadoMesaSection() {
  const sessaoPrivada = useStore((s) => s.sessaoPrivada);
  const atualizarSessaoPrivada = useStore((s) => s.atualizarSessaoPrivada);
  const iniciarSessaoTimer = useStore((s) => s.iniciarSessaoTimer);
  const encerrarSessaoTimer = useStore((s) => s.encerrarSessaoTimer);

  const { iniciadaEm } = sessaoPrivada.estatisticas;
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    if (!iniciadaEm) return;
    const tick = () => {
      if (document.visibilityState === 'visible') setAgora(Date.now());
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [iniciadaEm]);

  const gauges: { label: string; campo: 'tensao' | 'ruidoNarrativo' | 'ameaca' }[] = [
    { label: 'Tensão', campo: 'tensao' },
    { label: 'Ruído narrativo', campo: 'ruidoNarrativo' },
    { label: 'Ameaça', campo: 'ameaca' },
  ];

  return (
    <section className="secao">
      <h3>
        estado da mesa <span className="badge">privado</span>
      </h3>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span className="mono" style={{ fontSize: '13px' }}>
          {iniciadaEm ? `sessão em andamento — ${formatarDuracao(agora - new Date(iniciadaEm).getTime())}` : 'sessão não iniciada'}
        </span>
        {iniciadaEm ? (
          <button className="icone-botao perigo" onClick={encerrarSessaoTimer}>
            encerrar
          </button>
        ) : (
          <button className="icone-botao acento" onClick={iniciarSessaoTimer}>
            iniciar sessão
          </button>
        )}
      </div>

      {gauges.map(({ label, campo }) => (
        <div key={campo} style={{ marginBottom: '0.6rem' }}>
          <label htmlFor={`gauge-${campo}`}>
            {label} — {sessaoPrivada[campo]}%
          </label>
          <input
            id={`gauge-${campo}`}
            type="range"
            min={0}
            max={100}
            value={sessaoPrivada[campo]}
            onChange={(e) => atualizarSessaoPrivada({ [campo]: Number(e.target.value) })}
            style={{ width: '100%' }}
          />
          <BarraSegmentada atual={sessaoPrivada[campo]} maximo={100} variante="gauge" passoTick={25} />
        </div>
      ))}
    </section>
  );
}
