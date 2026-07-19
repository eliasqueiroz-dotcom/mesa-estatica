import { useStore } from '../../state/store';

/** Aba Sessão: metadados da mesa, editáveis ao vivo — refletem na tela compartilhada na hora. */
export default function SessaoTab() {
  const sessao = useStore((s) => s.sessao);
  const atualizarSessao = useStore((s) => s.atualizarSessao);
  const fichas = useStore((s) => s.fichas);
  const npcs = useStore((s) => s.npcs);

  return (
    <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="secao">
        <h3>mesa</h3>
        <div className="campos-grid">
          <div>
            <label htmlFor="sessao-nome">Nome da mesa</label>
            <input
              id="sessao-nome"
              type="text"
              value={sessao.nomeDaMesa}
              onChange={(e) => atualizarSessao({ nomeDaMesa: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="sessao-numero">Sessão nº</label>
            <input
              id="sessao-numero"
              type="number"
              min={1}
              value={sessao.numeroSessao}
              onChange={(e) => atualizarSessao({ numeroSessao: Number(e.target.value) || 1 })}
            />
          </div>
          <div>
            <label htmlFor="sessao-clima">Clima</label>
            <input
              id="sessao-clima"
              type="text"
              placeholder="garoa"
              value={sessao.clima}
              onChange={(e) => atualizarSessao({ clima: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="sessao-hora">Hora</label>
            <input
              id="sessao-hora"
              type="text"
              placeholder="23:41"
              value={sessao.hora}
              onChange={(e) => atualizarSessao({ hora: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="secao">
        <h3>cena atual</h3>
        <textarea
          value={sessao.cenaAtual}
          onChange={(e) => atualizarSessao({ cenaAtual: e.target.value })}
          placeholder="o que os jogadores estão vendo agora — atualiza ao vivo na tela compartilhada."
          style={{ minHeight: '6em' }}
        />
      </div>

      <div className="secao">
        <h3>mesa em números</h3>
        <p className="vazio">
          {fichas.length} personagem{fichas.length === 1 ? '' : 's'} · {npcs.length} NPC{npcs.length === 1 ? '' : 's'}{' '}
          cadastrado{npcs.length === 1 ? '' : 's'}
        </p>
      </div>
    </div>
  );
}
