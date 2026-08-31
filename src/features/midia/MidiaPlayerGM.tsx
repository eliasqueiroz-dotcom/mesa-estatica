import { useEffect, useRef, useState } from 'react';
import { fadeVolume } from '../../lib/audioFade';
import { estaAplicandoRemotoMidia } from '../../multiplayer/midiaEstadoSync';
import { calcularPosicaoEsperada, precisaResincronizar } from '../../multiplayer/posicaoMidia';
import { useMidiaUiStore } from '../../state/midiaUiStore';
import { useSoundpadUiStore } from '../../state/soundpadUiStore';
import { useStore } from '../../state/store';

const FATOR_DUCK = 0.35;
const FADE_TROCA_MS = 700;
const FADE_DUCK_MS = 250;

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
  const definirDuracao = useMidiaUiStore((s) => s.definirDuracao);
  const efeitoTocando = useSoundpadUiStore((s) => s.slotsTocando.size > 0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [bloqueado, setBloqueado] = useState(false);
  const [erroAudio, setErroAudio] = useState<string | null>(null);

  // refs (não deps de efeito) — usados só pra decidir se um fade deve disparar, sem forçar o
  // efeito de troca de faixa a reagir a `efeitoTocando` (esse é assunto do outro efeito, do duck).
  const fadeTokenRef = useRef(0);
  const prevFaixaIdRef = useRef<string | null>(null);
  const prevTocandoRef = useRef(false);
  const efeitoTocandoRef = useRef(efeitoTocando);
  efeitoTocandoRef.current = efeitoTocando;

  const faixaAtual = midia.faixas.find((f) => f.id === midia.faixaAtualId) ?? null;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.src !== faixaAtual?.url) {
      definirDuracao(0);
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

    // fade só entra numa troca de faixa/início/fim de verdade — não num resync puro de posição
    // (que também passa por aqui, via `atualizadoEm` nas deps).
    const trocou = prevFaixaIdRef.current !== midia.faixaAtualId || prevTocandoRef.current !== midia.tocando;
    prevFaixaIdRef.current = midia.faixaAtualId;
    prevTocandoRef.current = midia.tocando;
    const volumeAlvo = midia.volume * (efeitoTocandoRef.current ? FATOR_DUCK : 1);

    if (midia.tocando) {
      if (trocou) audio.volume = 0;
      audio.play().then(
        () => {
          setBloqueado(false);
          if (trocou) fadeVolume(audio, volumeAlvo, FADE_TROCA_MS, fadeTokenRef);
        },
        (erro) => {
          if (erro?.name === 'NotAllowedError') setBloqueado(true);
        },
      );
    } else if (trocou) {
      fadeVolume(audio, 0, FADE_TROCA_MS, fadeTokenRef, () => audio.pause());
    } else {
      audio.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midia.faixaAtualId, midia.tocando, midia.atualizadoEm]);

  // volume "de verdade" (slider do mestre) e duck automático (soundpad tocando) — os dois
  // convergem pro mesmo alvo, animado só quando é o duck entrando/saindo (o slider já dispara
  // muitos eventos sozinho ao arrastar; fade aí ficaria atrasado em vez de suave).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const volumeAlvo = midia.volume * (efeitoTocando ? FATOR_DUCK : 1);
    fadeVolume(audio, volumeAlvo, efeitoTocando ? FADE_DUCK_MS : 0, fadeTokenRef);
  }, [midia.volume, efeitoTocando]);

  const aoTerminar = () => {
    const s = useStore.getState();
    const ordenadas = [...s.midia.faixas].sort((a, b) => a.ordem - b.ordem);
    const idxAtual = ordenadas.findIndex((f) => f.id === s.midia.faixaAtualId);

    if (s.midia.modoLoop === 'faixa') {
      // reinicia direto no handler do evento nativo `ended`, sem esperar o round-trip
      // store → render → useEffect (linhas 42-85) — faixa/tocando não mudam de *valor* aqui
      // (já eram os mesmos antes de terminar), só o timestamp, então esse round-trip era a
      // ÚNICA coisa disparando o replay; em alguns navegadores isso falhava silenciosamente.
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        void audio.play().catch((erro) => {
          if (erro?.name === 'NotAllowedError') setBloqueado(true);
        });
      }
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
        onLoadedMetadata={(e) => definirDuracao(e.currentTarget.duration)}
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
