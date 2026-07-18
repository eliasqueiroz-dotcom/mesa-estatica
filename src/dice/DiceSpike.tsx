import { useEffect, useRef, useState } from 'react';
import DiceBox, { type RollGroupResult } from '@3d-dice/dice-box';

const NOTATIONS = ['1d20', '1d4', '1d6', '1d8', '1d10', '1d12', '2d8', '1d100'];

export default function DiceSpike() {
  const boxRef = useRef<DiceBox | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const box = new DiceBox({
      container: '#dice-spike-canvas',
      assetPath: '/assets/dice-box/',
      theme: 'default',
      themeColor: '#4fc1d4',
    });
    boxRef.current = box;
    box.onRollComplete = (results: RollGroupResult[]) => {
      const line = results
        .map((g) => `${g.qty}d${g.sides} → ${g.value} [${g.rolls.map((r) => r.value).join(', ')}]`)
        .join(' | ');
      setLog((prev) => [`${new Date().toLocaleTimeString()}  ${line}`, ...prev].slice(0, 20));
    };
    box
      .init()
      .then(() => setReady(true))
      .catch((err: unknown) => setError(String(err)));

    return () => {
      boxRef.current = null;
    };
  }, []);

  const roll = (notation: string) => {
    if (!boxRef.current) return;
    boxRef.current.roll(notation).catch((err: unknown) => setError(String(err)));
  };

  return (
    <div>
      <div
        id="dice-spike-canvas"
        style={{
          width: '100%',
          height: '400px',
          background: 'var(--concrete-0)',
          border: '1px solid var(--concrete-2)',
        }}
      />
      {error && (
        <p className="mono" style={{ color: 'var(--ruido)' }}>
          erro: {error}
        </p>
      )}
      {!ready && !error && <p className="mono">carregando física dos dados…</p>}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '1rem 0' }}>
        {NOTATIONS.map((n) => (
          <button key={n} disabled={!ready} onClick={() => roll(n)}>
            {n}
          </button>
        ))}
      </div>
      <div className="mono" style={{ fontSize: '13px', color: 'var(--ink-dim)' }}>
        {log.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
}
