import { useStore } from '../../state/store';
import type { Pista, StatusPista } from '../../state/types';
import './pistas.css';

const COLUNAS: { status: StatusPista; titulo: string; cor: string; vazio: string }[] = [
  { status: 'nao-descoberta', titulo: 'não descobertas', cor: 'var(--ink-faint)', vazio: 'nenhuma pista plantada ainda.' },
  { status: 'descoberta', titulo: 'descobertas', cor: 'var(--real)', vazio: 'nada descoberto ainda.' },
  { status: 'compartilhada', titulo: 'compartilhadas com jogadores', cor: 'var(--rede)', vazio: 'nada revelado à mesa ainda.' },
];

function PistaCard({ pista }: { pista: Pista }) {
  const atualizarPista = useStore((s) => s.atualizarPista);
  const removerPista = useStore((s) => s.removerPista);

  const indiceAtual = COLUNAS.findIndex((c) => c.status === pista.status);
  const anterior = COLUNAS[indiceAtual - 1];
  const proxima = COLUNAS[indiceAtual + 1];

  return (
    <div className="pista-card" style={{ ['--coluna-cor' as string]: COLUNAS[indiceAtual].cor }}>
      <textarea
        value={pista.texto}
        placeholder="o que essa pista revela ou sugere…"
        onChange={(e) => atualizarPista(pista.id, { texto: e.target.value })}
      />
      <input
        type="text"
        value={pista.ligadoA}
        placeholder="ligado a — NPC, local, caso…"
        onChange={(e) => atualizarPista(pista.id, { ligadoA: e.target.value })}
        style={{ fontSize: 12 }}
      />
      <div className="pista-card__rodape">
        <div className="pista-card__mover">
          <button
            className="icone-botao"
            disabled={!anterior}
            title={anterior ? `mover para "${anterior.titulo}"` : undefined}
            onClick={() => anterior && atualizarPista(pista.id, { status: anterior.status })}
          >
            ‹
          </button>
          <button
            className="icone-botao"
            disabled={!proxima}
            title={proxima ? `mover para "${proxima.titulo}"` : undefined}
            onClick={() => proxima && atualizarPista(pista.id, { status: proxima.status })}
          >
            ›
          </button>
        </div>
        <button className="icone-botao perigo" onClick={() => removerPista(pista.id)}>
          ×
        </button>
      </div>
    </div>
  );
}

export default function PistasTab() {
  const pistas = useStore((s) => s.pistas);
  const adicionarPista = useStore((s) => s.adicionarPista);

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
        <h3 className="label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Quadro de pistas
          <span className="badge">privado — só o mestre</span>
        </h3>
        <button className="acento" onClick={() => adicionarPista()}>
          + pista
        </button>
      </div>
      <p className="vazio" style={{ marginBottom: '1rem' }}>
        esta aba não existe no app do jogador — mesmo publicado no site, ninguém além do mestre a vê. marcar uma pista como
        "compartilhada" não revela nada sozinho; é só o seu lembrete de que já contou pros jogadores.
      </p>

      <div className="pista-quadro">
        {COLUNAS.map((coluna) => {
          const itens = pistas.filter((p) => p.status === coluna.status);
          return (
            <div key={coluna.status} className="pista-coluna">
              <div className="pista-coluna__titulo" style={{ ['--coluna-cor' as string]: coluna.cor }}>
                <span className="label">{coluna.titulo}</span>
                <span className="mono vazio">{itens.length}</span>
              </div>
              {itens.length === 0 && <p className="vazio">{coluna.vazio}</p>}
              {itens.map((pista) => (
                <PistaCard key={pista.id} pista={pista} />
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
