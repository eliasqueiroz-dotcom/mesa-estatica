import { useDiceBox } from '../../dice/useDiceBox';
import RoladorTeste from './RoladorTeste';
import RoladorSanidade from './RoladorSanidade';
import RoladorSurto from './RoladorSurto';
import RoladorTrauma from './RoladorTrauma';
import RolagemLivre from './RolagemLivre';

export default function DadosTab({ active = true }: { active?: boolean }) {
  const { ready, rolando, erro, modo2D, rolar } = useDiceBox('dice-bandeja', active);
  // os 5 roladores compartilham UMA bandeja física — a lib não protege roll() concorrente
  // (ver comentário em useDiceBox.rolar), então "pronto pra rolar" tem que valer pra todos ao
  // mesmo tempo: enquanto qualquer um está rolando, os botões dos outros também ficam desabilitados.
  const podeRolar = ready && !rolando;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', alignItems: 'start' }}>
      {!modo2D && (
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
      )}
      {modo2D && (
        <div className="secao" style={{ gridColumn: '1 / -1' }}>
          <p className="vazio">
            renderização 3D indisponível nesta máquina (sem WebGL) — os dados ainda funcionam, só sem o visual físico.
            resultados abaixo continuam honestos por padrão e respeitam a rolagem forçada normalmente.
          </p>
        </div>
      )}
      {erro && !modo2D && <p style={{ color: 'var(--ruido)' }}>erro: {erro}</p>}
      {!ready && !erro && <p className="vazio">carregando física dos dados…</p>}

      <RoladorTeste ready={podeRolar} rolar={rolar} />
      <RoladorSanidade ready={podeRolar} rolar={rolar} />
      <RoladorSurto ready={podeRolar} rolar={rolar} />
      <RoladorTrauma ready={podeRolar} rolar={rolar} />
      <RolagemLivre ready={podeRolar} rolar={rolar} />
    </div>
  );
}
