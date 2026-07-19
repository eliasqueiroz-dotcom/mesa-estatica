import { useStore } from '../../../state/store';

/** §1 — Situação da sessão [Público]: identidade da mesa + onde a investigação está. */
export default function SituacaoSection() {
  const sessaoPublica = useStore((s) => s.sessaoPublica);
  const atualizarSessaoPublica = useStore((s) => s.atualizarSessaoPublica);

  return (
    <section className="secao">
      <h3>situação da sessão</h3>
      <div className="campos-grid">
        <div>
          <label htmlFor="sessao-nome">Nome da mesa</label>
          <input
            id="sessao-nome"
            type="text"
            value={sessaoPublica.nomeDaMesa}
            onChange={(e) => atualizarSessaoPublica({ nomeDaMesa: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="sessao-numero">Sessão nº</label>
          <input
            id="sessao-numero"
            type="number"
            min={1}
            value={sessaoPublica.numeroSessao}
            onChange={(e) => atualizarSessaoPublica({ numeroSessao: Number(e.target.value) || 1 })}
          />
        </div>
        <div>
          <label htmlFor="sessao-clima">Clima</label>
          <input
            id="sessao-clima"
            type="text"
            placeholder="garoa"
            value={sessaoPublica.clima}
            onChange={(e) => atualizarSessaoPublica({ clima: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="sessao-hora">Hora</label>
          <input
            id="sessao-hora"
            type="text"
            placeholder="23:41"
            value={sessaoPublica.hora}
            onChange={(e) => atualizarSessaoPublica({ hora: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="sessao-caso">Caso atual</label>
          <input
            id="sessao-caso"
            type="text"
            placeholder="o silêncio da luz"
            value={sessaoPublica.caso}
            onChange={(e) => atualizarSessaoPublica({ caso: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="sessao-local">Local atual</label>
          <input
            id="sessao-local"
            type="text"
            placeholder="estação da luz"
            value={sessaoPublica.localAtual}
            onChange={(e) => atualizarSessaoPublica({ localAtual: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="sessao-objetivo">Objetivo dos jogadores</label>
          <input
            id="sessao-objetivo"
            type="text"
            placeholder="encontrar o informante"
            value={sessaoPublica.objetivo}
            onChange={(e) => atualizarSessaoPublica({ objetivo: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="sessao-progresso">Progresso da investigação</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <input
              id="sessao-progresso"
              type="number"
              min={0}
              value={sessaoPublica.progresso.atual}
              onChange={(e) =>
                atualizarSessaoPublica({
                  progresso: { ...sessaoPublica.progresso, atual: Math.max(0, Number(e.target.value) || 0) },
                })
              }
            />
            <span className="vazio">/</span>
            <input
              type="number"
              min={0}
              value={sessaoPublica.progresso.total}
              onChange={(e) =>
                atualizarSessaoPublica({
                  progresso: { ...sessaoPublica.progresso, total: Math.max(0, Number(e.target.value) || 0) },
                })
              }
            />
            <span className="vazio">pistas</span>
          </div>
        </div>
      </div>
    </section>
  );
}
