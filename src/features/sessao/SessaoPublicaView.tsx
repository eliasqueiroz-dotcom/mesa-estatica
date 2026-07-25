import { useStore } from '../../state/store';

const N = 5;

/**
 * Projeção pública da aba Sessão (mesa-estatica-multiplayer-completo.md Parte IV §5) — o que o
 * `PlayerApp` mostra: `sessaoPublica` (situação + partes públicas da cena atual) e o mini log.
 * Nunca `sessaoPrivada` (Tensão/Ruído/Ameaça, lembretes, "o que realmente acontece", próximo
 * evento, dificuldade da cena) — esses campos nem chegam como prop, ficam em `sessaoPrivada`,
 * inacessível a este componente por construção.
 *
 * Só leitura, de propósito — sem inputs, sem ações do store. `SituacaoSection`/`CenaAtualSection`
 * continuam sendo os editores do mestre; esta view é a versão reduzida pro jogador.
 */
export default function SessaoPublicaView() {
  const sessaoPublica = useStore((s) => s.sessaoPublica);
  const log = useStore((s) => s.log);
  // defesa em profundidade — mesmo filtro de LogView.tsx: rolagem privada nunca aparece pro
  // jogador (registrarLog embute o resultado no texto livre, sem checagem de visibilidade nele).
  const ultimos = log.filter((e) => e.visibilidade !== 'privada').slice(0, N);

  const { nomeDaMesa, numeroSessao, clima, hora, caso, localAtual, objetivo, atmosfera, cenaAtual } = sessaoPublica;

  return (
    <div className="sessao-publica-view">
      <section className="secao">
        <h3>situação da sessão</h3>
        <div className="campos-grid">
          <div>
            <span className="vazio">mesa</span>
            <p className="mono">{nomeDaMesa || '—'}</p>
          </div>
          <div>
            <span className="vazio">sessão nº</span>
            <p className="mono">{numeroSessao}</p>
          </div>
          <div>
            <span className="vazio">clima</span>
            <p className="mono">{clima || '—'}</p>
          </div>
          <div>
            <span className="vazio">hora</span>
            <p className="mono">{hora || '—'}</p>
          </div>
          <div>
            <span className="vazio">caso atual</span>
            <p className="mono">{caso || '—'}</p>
          </div>
          <div>
            <span className="vazio">local atual</span>
            <p className="mono">{localAtual || '—'}</p>
          </div>
          <div>
            <span className="vazio">objetivo dos jogadores</span>
            <p className="mono">{objetivo || '—'}</p>
          </div>
        </div>
      </section>

      <section className="secao">
        <h3>cena atual</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <span className="vazio">atmosfera</span>
            <p className="mono">{atmosfera || '—'}</p>
          </div>
          <div>
            <span className="vazio">o que os jogadores veem</span>
            <p>{cenaAtual || '—'}</p>
          </div>
        </div>
      </section>

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
    </div>
  );
}
