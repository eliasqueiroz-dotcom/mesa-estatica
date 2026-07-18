import DiceSpike from '../dice/DiceSpike';

export default function App() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Estática — spike Dia 1</h1>
      <p className="mono" style={{ color: 'var(--ink-dim)' }}>
        validação isolada do @3d-dice/dice-box antes de integrar ao resto da ferramenta.
      </p>
      <DiceSpike />
    </div>
  );
}
