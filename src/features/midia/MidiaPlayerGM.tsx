import { useEffect, useRef, useState } from 'react';
import { estaAplicandoRemotoMidia } from '../../multiplayer/midiaEstadoSync';
import { calcularPosicaoEsperada, precisaResincronizar } from '../../multiplayer/posicaoMidia';
import { useStore } from '../../state/store';

/**
 * Motor de playback do lado do mestre — renderizado dentro do `<header>` do `App.tsx` (não
 * dentro da aba Mídia). Prender o `<audio>` ao componente de UMA aba seria frágil (um refactor
 * futuro que desmonte a aba mataria o áudio sem aviso) e o auto-avanço (`onEnded`) precisa
 * rodar mesmo com o mestre em outra aba. Sem UI de transporte visível — isso é `MidiaTab.tsx`,
 * que só despacha ações no store; este componente só espelha `s.midia` no `<audio>` de verdade.
 *
 * O aviso de bloqueio/erro já foi `position: fixed` no canto inferior esquerdo — cobria o fim
 * de listas longas em outras abas (mesmo bug do lado do jogador, `MidiaPlayerJogador.tsx`).
 * Morar no header evita colidir com o conteúdo rolável de qualquer aba.
 */
export default function MidiaPlayerGM() {
  const midia = useStore((s) => s.midia);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [bloqueado, setBloqueado] = useState(false);
  const [erroAudio, setErroAudio] = useState<string | null>(null);

  const faixaAtual = midia.faixas.find((f) => f.id === midia.faixaAtualId) ?? null;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.src !== faixaAtual?.url) {
      audio.src = faixaAtual?.url ?? '';
      setErroAudio(null);
    }
    if (!faixaAtual) return;

    const remoto = estaAplicandoRemotoMidia();
    if (remoto) {
      const esperado = calcularPosicaoEsperada(midia);
      if (precisaResincronizar(audio.currentTime, esperado)) audio.currentTime = esperado;
    } else {
      audio.currentTime = midia.posicaoSegundos;
    }

    if (midia.tocando) {
      audio.play().then(
        () => setBloqueado(false),
        (erro) => {
          if (erro?.name === 'NotAllowedError') setBloqueado(true);
        },
      );
    } else {
      audio.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midia.faixaAtualId, midia.tocando, midia.atualizadoEm]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = midia.volume;
  }, [midia.volume]);

  const aoTerminar = () => {
    const s = useStore.getState();
    const ordenadas = [...s.midia.faixas].sort((a, b) => a.ordem - b.ordem);
    const idxAtual = ordenadas.findIndex((f) => f.id === s.midia.faixaAtualId);

    if (s.midia.modoLoop === 'faixa') {
      s.atualizarEstadoMidia({ posicaoSegundos: 0, tocando: true });
      return;
    }
    if (idxAtual === -1) return;
    const proximaIdx = idxAtual + 1;
    if (proximaIdx < ordenadas.length) {
      s.atualizarEstadoMidia({ faixaAtualId: ordenadas[proximaIdx].id, posicaoSegundos: 0, tocando: true });
    } else if (s.midia.modoLoop === 'lista' && ordenadas.length > 0) {
      s.atualizarEstadoMidia({ faixaAtualId: ordenadas[0].id, posicaoSegundos: 0, tocando: true });
    } else {
      s.atualizarEstadoMidia({ tocando: false, posicaoSegundos: 0 });
    }
  };

  const retomar = () => {
    audioRef.current
      ?.play()
      .then(() => setBloqueado(false))
      .catch(() => {});
  };

  return (
    <>
      <audio
        ref={audioRef}
        onEnded={aoTerminar}
        onError={() => faixaAtual && setErroAudio(`não consegui tocar "${faixaAtual.nome}" — formato não suportado neste navegador.`)}
      />
      {(bloqueado || erroAudio) && (
        <div
          className="mono"
          style={{
            background: 'var(--concrete-1)',
            border: '1px solid var(--ruido-dim)',
            borderRadius: '2px',
            padding: '0.3em 0.6em',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            maxWidth: '260px',
          }}
        >
          {bloqueado ? (
            <>
              <span style={{ color: 'var(--ruido)' }}>áudio bloqueado pelo navegador</span>
              <button onClick={retomar}>retomar áudio</button>
            </>
          ) : (
            <span style={{ color: 'var(--ruido)' }}>{erroAudio}</span>
          )}
        </div>
      )}
    </>
  );
}
