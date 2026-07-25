import { useEffect, useRef, useState } from 'react';
import { calcularPosicaoEsperada, precisaResincronizar } from '../../multiplayer/posicaoMidia';
import { useStore } from '../../state/store';

/**
 * Motor de playback do lado do jogador — monta na raiz do `PlayerApp.tsx`, mesmo raciocínio
 * de `MidiaPlayerGM.tsx` (não desmonta trocando de aba). Nunca escreve em `s.midia` — só
 * espelha o que o mestre manda, sempre com o limiar de desvio (não existe "ação local" aqui
 * pra pular a checagem, diferente do lado do mestre).
 *
 * Volume é controlado só pelo GM (`midia.volume`, sincronizado — slider em `MidiaTab.tsx`) —
 * decisão do usuário, todo mundo ouve no mesmo nível. Mudo continua local (cada jogador
 * silencia só pra si, sem afetar os outros nem precisar de permissão do mestre).
 */
export default function MidiaPlayerJogador() {
  const midia = useStore((s) => s.midia);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [desbloqueado, setDesbloqueado] = useState(false);
  const [mudo, setMudo] = useState(false);

  const faixaAtual = midia.faixas.find((f) => f.id === midia.faixaAtualId) ?? null;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.src !== faixaAtual?.url) audio.src = faixaAtual?.url ?? '';
    if (!faixaAtual) return;

    const esperado = calcularPosicaoEsperada(midia);
    if (precisaResincronizar(audio.currentTime, esperado)) audio.currentTime = esperado;

    if (!desbloqueado) return; // sem gesto do usuário ainda — só prepara, não toca

    if (midia.tocando) audio.play().catch(() => {});
    else audio.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midia.faixaAtualId, midia.tocando, midia.atualizadoEm, desbloqueado]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = midia.volume;
  }, [midia.volume]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = mudo;
  }, [mudo]);

  const habilitar = () => {
    setDesbloqueado(true);
    const audio = audioRef.current;
    if (audio && midia.tocando) audio.play().catch(() => {});
  };

  return (
    <>
      <audio ref={audioRef} />
      <div
        className="mono"
        style={{
          position: 'fixed',
          bottom: '1rem',
          left: '1rem',
          zIndex: 70,
          background: 'var(--concrete-1)',
          border: '1px solid var(--concrete-2)',
          borderRadius: '2px',
          padding: '0.5em 0.8em',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          maxWidth: '280px',
        }}
      >
        {!desbloqueado ? (
          <button onClick={habilitar}>habilitar áudio</button>
        ) : (
          <>
            <span style={{ color: 'var(--rede)' }}>♪</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {faixaAtual ? faixaAtual.nome : 'sem áudio tocando'}
            </span>
            <button className="icone-botao" onClick={() => setMudo((m) => !m)} title={mudo ? 'ativar som' : 'mudo (só pra você)'}>
              {mudo ? 'mudo' : 'som'}
            </button>
          </>
        )}
      </div>
    </>
  );
}
