import { useStore } from '../../state/store';

/**
 * Aba Mídia do jogador — playlist somente-leitura + faixa atual. O widget flutuante
 * (`MidiaPlayerJogador.tsx`) já cobre o essencial (desbloquear áudio/volume/nome da faixa);
 * esta view é só pra quem quiser ver a fila inteira sem procurar o widget.
 */
export default function MidiaJogadorView() {
  const midia = useStore((s) => s.midia);
  const ordenadas = [...midia.faixas].sort((a, b) => a.ordem - b.ordem);

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', height: '100%', overflowY: 'auto' }}>
      <h3 className="label" style={{ margin: 0 }}>
        playlist
      </h3>
      {ordenadas.length === 0 ? (
        <p className="vazio">nada na fila ainda.</p>
      ) : (
        ordenadas.map((faixa) => (
          <div
            key={faixa.id}
            style={{
              padding: '0.4rem 0.5rem',
              border: '1px solid var(--concrete-2)',
              borderRadius: '2px',
              background: faixa.id === midia.faixaAtualId ? 'var(--concrete-1)' : undefined,
            }}
          >
            {faixa.id === midia.faixaAtualId && (midia.tocando ? '▶ ' : '❚❚ ')}
            {faixa.nome}
          </div>
        ))
      )}
    </div>
  );
}
