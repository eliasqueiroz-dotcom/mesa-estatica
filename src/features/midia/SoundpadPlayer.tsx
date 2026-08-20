import { useEffect, useRef } from 'react';
import { useSoundpadUiStore } from '../../state/soundpadUiStore';
import { useStore } from '../../state/store';

/**
 * Toca os efeitos do soundpad — montado no `<header>` de `App.tsx`/`PlayerApp.tsx`, fora das
 * abas, mesmo motivo dos players de música (não desmonta ao trocar de aba). Não renderiza nada.
 *
 * Um `Audio` por SLOT (`audiosPorSlot`, não um único `audioAtual`) — é o que permite dois
 * slots diferentes se sobreporem sem um cortar o outro, e também é o que faz `pararSoundpad`
 * conseguir interromper só a instância certa. Um novo 'tocar' no mesmo slot para a instância
 * anterior antes de criar a nova (não faz sentido dois efeitos do mesmo botão ao mesmo tempo).
 *
 * Dedupe pelo carimbo `em`: o mesmo disparo chega aqui mais de uma vez (a ação local do GM e
 * depois o eco do Realtime, e um refetch de reconexão pode repetir o último). Guardar o
 * carimbo já tocado garante uma ação por clique.
 *
 * Autoplay: o navegador só libera `play()` depois de algum gesto do usuário na página. No lado
 * do jogador isso já acontece no botão "habilitar áudio" do `MidiaPlayerJogador`; antes disso o
 * efeito falha em silêncio, que é o comportamento correto (nada de erro no meio da cena).
 *
 * `sons` e `volume` vão pra refs (atualizados por subscriber) pra que o efeito principal
 * reaja **só** a `ultimoDisparo`. O subscriber também ajusta o volume de todo áudio tocando.
 *
 * `useSoundpadUiStore` é quem `SoundpadGrid.tsx` lê pra saber se um slot está tocando NESTE
 * cliente agora (fato local — cada cliente toca seu próprio `<audio>`, não é estado
 * compartilhado) e decidir se o clique no botão deve tocar ou parar.
 */
export default function SoundpadPlayer() {
  const ultimoDisparo = useStore((s) => s.soundpad.ultimoDisparo);
  const jaTocado = useRef<string | null>(null);
  const audiosPorSlot = useRef<Map<number, HTMLAudioElement>>(new Map());

  const sonsRef = useRef(useStore.getState().soundpad.sons);
  const volumeRef = useRef(useStore.getState().soundpad.volume);
  useEffect(
    () =>
      useStore.subscribe((s) => {
        sonsRef.current = s.soundpad.sons;
        volumeRef.current = s.soundpad.volume;
        for (const audio of audiosPorSlot.current.values()) audio.volume = s.soundpad.volume;
      }),
    [],
  );

  useEffect(() => {
    if (!ultimoDisparo || ultimoDisparo.em === jaTocado.current) return;
    jaTocado.current = ultimoDisparo.em;
    const { slot, tipo } = ultimoDisparo;

    if (tipo === 'parar') {
      audiosPorSlot.current.get(slot)?.pause();
      audiosPorSlot.current.delete(slot);
      useSoundpadUiStore.getState().marcarParado(slot);
      return;
    }

    const som = sonsRef.current.find((s) => s.slot === slot);
    if (!som?.url) return;

    audiosPorSlot.current.get(slot)?.pause();

    const audio = new Audio(som.url);
    audio.volume = volumeRef.current;
    const encerrar = () => {
      audiosPorSlot.current.delete(slot);
      useSoundpadUiStore.getState().marcarParado(slot);
    };
    audio.addEventListener('ended', encerrar);
    audiosPorSlot.current.set(slot, audio);
    useSoundpadUiStore.getState().marcarTocando(slot);
    audio.play().catch(encerrar);
  }, [ultimoDisparo]);

  return null;
}
