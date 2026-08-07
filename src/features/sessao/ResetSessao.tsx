import { useEffect, useState } from 'react';
import { resetarMesaCompleta } from '../../multiplayer/resetMesa';
import { useStore } from '../../state/store';

/**
 * Botão de "sessão limpa" — mora ao lado de "limpar log", no header do `LogView`, mas entra lá
 * como slot vindo do `LogTab.tsx` (GM-only). O `LogView` é compartilhado com o app do jogador:
 * importar este componente lá dentro arrastaria `resetMesa`/`remocaoExplicita` pro bundle dele.
 *
 * Destrutivo e irreversível (apaga no servidor também, ver `resetMesa.ts`), então a confirmação
 * é um modal — mesmo padrão de `VinculoMestre.tsx` — com o backup oferecido no meio do caminho,
 * enquanto ainda existe o que salvar.
 */
export default function ResetSessao() {
  const [modalAberto, setModalAberto] = useState(false);
  const [resetando, setResetando] = useState(false);

  useEffect(() => {
    if (!modalAberto) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !resetando) setModalAberto(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [modalAberto, resetando]);

  const baixarBackup = () => {
    const blob = new Blob([useStore.getState().exportarJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estatica-mesa-antes-do-reset-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const confirmar = async () => {
    setResetando(true);
    try {
      await resetarMesaCompleta();
      setModalAberto(false);
    } finally {
      setResetando(false);
    }
  };

  return (
    <>
      <button className="perigo" onClick={() => setModalAberto(true)}>
        iniciar sessão limpa
      </button>

      {modalAberto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(11, 13, 17, 0.6)',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => !resetando && setModalAberto(false)}
        >
          <div
            className="secao"
            style={{
              width: 460,
              maxWidth: '90vw',
              borderColor: 'var(--ruido)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, color: 'var(--ruido)' }}>sessão limpa</h3>
            <p className="vazio" style={{ margin: 0 }}>
              apaga personagens, NPCs, iniciativa, mapa, pistas, mídia, log e rolagens — aqui e no
              servidor, pra todo mundo. não dá pra desfazer.
            </p>
            <p className="vazio" style={{ margin: 0 }}>
              os links de jogador atuais param de valer (as fichas somem junto). os arquivos de
              áudio continuam no armazenamento, só saem da playlist.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
              <button className="acento" onClick={baixarBackup} disabled={resetando}>
                baixar backup antes
              </button>
              <button className="perigo" onClick={confirmar} disabled={resetando}>
                {resetando ? 'apagando…' : 'confirmar — apaga tudo'}
              </button>
              <button onClick={() => setModalAberto(false)} disabled={resetando}>
                cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
