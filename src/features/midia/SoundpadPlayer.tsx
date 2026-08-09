import { useEffect, useRef } from 'react';
import { useStore } from '../../state/store';

/**
 * Toca os efeitos do soundpad — montado no `<header>` de `App.tsx`/`PlayerApp.tsx`, fora das
 * abas, mesmo motivo dos players de música (não desmonta ao trocar de aba). Não renderiza nada.
 *
 * Cada disparo cria um `Audio` novo em vez de reusar um `<audio>` fixo: é o que faz o efeito
 * tocar POR CIMA da música (elemento separado do `<audio>` da jukebox, que continua intocado)
 * e permite dois efeitos se sobreporem sem um cortar o outro.
 *
 * Dedupe pelo carimbo `em`: o mesmo disparo chega aqui mais de uma vez (a ação local do GM e
 * depois o eco do Realtime, e um refetch de reconexão pode repetir o último). Guardar o
 * carimbo já tocado garante um efeito por clique.
 *
 * Autoplay: o navegador só libera `play()` depois de algum gesto do usuário na página. No lado
 * do jogador isso já acontece no botão "habilitar áudio" do `MidiaPlayerJogador`; antes disso o
 * efeito falha em silêncio, que é o comportamento correto (nada de erro no meio da cena).
 *
 * `sons` e `volume` vão pra refs (atualizados por subscriber) pra que o efeito principal
 * reaja **só** a `ultimoDisparo`. O subscriber também ajusta o volume do áudio tocando ao vivo.
 */
export default function SoundpadPlayer() {
  const ultimoDisparo = useStore((s) => s.soundpad.ultimoDisparo);
  const jaTocado = useRef<string | null>(null);
  const audioAtual = useRef<HTMLAudioElement | null>(null);

  const sonsRef = useRef(useStore.getState().soundpad.sons);
  const volumeRef = useRef(useStore.getState().soundpad.volume);
  useEffect(
    () =>
      useStore.subscribe((s) => {
        sonsRef.current = s.soundpad.sons;
        volumeRef.current = s.soundpad.volume;
        if (audioAtual.current) audioAtual.current.volume = s.soundpad.volume;
      }),
    [],
  );

  useEffect(() => {
    if (!ultimoDisparo || ultimoDisparo.em === jaTocado.current) return;
    jaTocado.current = ultimoDisparo.em;

    const som = sonsRef.current.find((s) => s.slot === ultimoDisparo.slot);
    if (!som?.url) return;

    const audio = new Audio(som.url);
    audio.volume = volumeRef.current;
    audioAtual.current = audio;
    audio.play().catch(() => {});
  }, [ultimoDisparo]);

  return null;
}
