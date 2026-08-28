import { useEffect, useRef, useState } from 'react';
import { fadeVolume } from '../../lib/audioFade';
import { calcularPosicaoEsperada, precisaResincronizar } from '../../multiplayer/posicaoMidia';
import { useSoundpadUiStore } from '../../state/soundpadUiStore';
import { useStore } from '../../state/store';

const FATOR_DUCK = 0.35;
const FADE_TROCA_MS = 700;
const FADE_DUCK_MS = 250;

/**
 * Motor de playback do lado do jogador — renderizado dentro do `<header>` do `PlayerApp.tsx`
 * (não dentro de uma aba), mesmo raciocínio de `MidiaPlayerGM.tsx` (não desmonta trocando de
 * aba). Nunca escreve em `s.midia` — só espelha o que o mestre manda, sempre com o limiar de
 * desvio (não existe "ação local" aqui pra pular a checagem, diferente do lado do mestre).
 *
 * Já foi `position: fixed` no canto inferior esquerdo da tela — cobria o fim de listas longas
 * (ficha de outros jogadores na aba Personagens, achado ao vivo). Como header não faz parte da
 * área rolável de nenhuma aba, morar ali resolve pra qualquer aba, não só a que reportou o bug.
 *
 * Volume é controlado só pelo GM (`midia.volume`, sincronizado — slider em `MidiaTab.tsx`) —
 * decisão do usuário, todo mundo ouve no mesmo nível. Mudo continua local (cada jogador
 * silencia só pra si, sem afetar os outros nem precisar de permissão do mestre).
 */
export default function MidiaPlayerJogador() {
  const midia = useStore((s) => s.midia);
  const efeitoTocando = useSoundpadUiStore((s) => s.slotsTocando.size > 0);
  const mudo = useSoundpadUiStore((s) => s.mudo);
  const definirMudo = useSoundpadUiStore((s) => s.definirMudo);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [desbloqueado, setDesbloqueado] = useState(false);

  const fadeTokenRef = useRef(0);
  const prevFaixaIdRef = useRef<string | null>(null);
  const prevTocandoRef = useRef(false);
  const efeitoTocandoRef = useRef(efeitoTocando);
  efeitoTocandoRef.current = efeitoTocando;

  const faixaAtual = midia.faixas.find((f) => f.id === midia.faixaAtualId) ?? null;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.src !== faixaAtual?.url) audio.src = faixaAtual?.url ?? '';
    if (!faixaAtual) return;

    const esperado = calcularPosicaoEsperada(midia);
    if (precisaResincronizar(audio.currentTime, esperado)) audio.currentTime = esperado;

    // fade só entra numa troca de faixa/início/fim de verdade — não num resync puro de posição.
    const trocou = prevFaixaIdRef.current !== midia.faixaAtualId || prevTocandoRef.current !== midia.tocando;
    prevFaixaIdRef.current = midia.faixaAtualId;
    prevTocandoRef.current = midia.tocando;

    if (!desbloqueado) return; // sem gesto do usuário ainda — só prepara, não toca

    const volumeAlvo = midia.volume * (efeitoTocandoRef.current ? FATOR_DUCK : 1);
    if (midia.tocando) {
      if (trocou) audio.volume = 0;
      audio
        .play()
        .then(() => {
          if (trocou) fadeVolume(audio, volumeAlvo, FADE_TROCA_MS, fadeTokenRef);
        })
        .catch(() => {});
    } else if (trocou) {
      fadeVolume(audio, 0, FADE_TROCA_MS, fadeTokenRef, () => audio.pause());
    } else {
      audio.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midia.faixaAtualId, midia.tocando, midia.atualizadoEm, desbloqueado]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const volumeAlvo = midia.volume * (efeitoTocando ? FATOR_DUCK : 1);
    fadeVolume(audio, volumeAlvo, efeitoTocando ? FADE_DUCK_MS : 0, fadeTokenRef);
  }, [midia.volume, efeitoTocando]);

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
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '11px',
          maxWidth: '200px',
        }}
      >
        {!desbloqueado ? (
          <button onClick={habilitar} style={{ fontSize: '11px', padding: '0.3em 0.6em' }}>
            habilitar áudio
          </button>
        ) : (
          <>
            <span style={{ color: 'var(--rede)' }}>♪</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {faixaAtual ? faixaAtual.nome : 'sem áudio tocando'}
            </span>
            <button className="icone-botao" onClick={() => definirMudo(!mudo)} title={mudo ? 'ativar som' : 'mudo (só pra você)'} style={{ fontSize: '10px' }}>
              {mudo ? 'mudo' : 'som'}
            </button>
          </>
        )}
      </div>
    </>
  );
}
