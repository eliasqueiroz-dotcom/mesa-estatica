import { useDiceBox } from '../../dice/useDiceBox';
import RoladorTeste from './RoladorTeste';
import RoladorSanidade from './RoladorSanidade';
import RoladorSurto from './RoladorSurto';
import RoladorTrauma from './RoladorTrauma';
import RolagemLivre from './RolagemLivre';

export default function DadosTab({ active = true }: { active?: boolean }) {
  const { ready, erro, rolar } = useDiceBox('dice-bandeja', active);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', alignItems: 'start' }}>
      <div
        id="dice-bandeja"
        style={{
          gridColumn: '1 / -1',
          width: '100%',
          height: '280px',
          background: 'var(--concrete-0)',
          border: '1px solid var(--concrete-2)',
        }}
      />
      {erro && <p style={{ color: 'var(--ruido)' }}>erro: {erro}</p>}
      {!ready && !erro && <p className="vazio">carregando física dos dados…</p>}

      <RoladorTeste ready={ready} rolar={rolar} />
      <RoladorSanidade ready={ready} rolar={rolar} />
      <RoladorSurto ready={ready} rolar={rolar} />
      <RoladorTrauma ready={ready} rolar={rolar} />
      <RolagemLivre ready={ready} rolar={rolar} />
    </div>
  );
}
