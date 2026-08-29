import { useEffect, useRef } from 'react';
import type { useDiceBox } from './useDiceBox';
import { ehRolagemPropria, useRolagemAoVivoStore, type RolagemAoVivo } from '../state/rolagemAoVivoStore';

interface Callbacks {
  aoIniciar?: (r: RolagemAoVivo) => void;
  aoTerminar?: (r: RolagemAoVivo) => void;
}

/**
 * Reproduz a rolagem ao vivo mais recente (`rolagemAoVivoStore`) na bandeja física de quem
 * chama — mesma lógica que `RolagemAoVivoPlayer.tsx` já usava sozinho, extraída pra reusar em
 * `DadosTab.tsx`/`DadosTabJogador.tsx` (a própria bandeja da aba Dados também deve animar a
 * rolagem de outra pessoa quando essa aba está aberta, não só o mini-aviso do header).
 *
 * `pronto` já cobre "está na aba certa": `useDiceBox` deixa `ready` false sempre que `enabled`
 * (a prop `active` da aba) é false — uma rolagem que chega enquanto o usuário está em outra aba
 * simplesmente não é reproduzida ali, sem precisar de gate adicional.
 *
 * Filtra `ehRolagemPropria` — sem isso, quem acabou de rolar veria a própria bandeja (ou o
 * próprio header) tocar o mesmo resultado de novo, já que `definirAtual` (o que dispara o
 * broadcast pros outros) também aciona os consumidores locais do mesmo store.
 */
export function useReproduzirRolagemAoVivo(
  reproduzir: ReturnType<typeof useDiceBox>['reproduzir'],
  pronto: boolean,
  callbacks?: Callbacks,
  /** true só no header do mestre (`App.tsx`) — o mestre dispara ataque/dano de PC, ações de NPC
   *  e perícia pela própria tela (`ArmasCombate.tsx`/`PericiasSection.tsx`), então `marcarComoProprio`
   *  sempre marcaria essas rolagens como seu próprio eco e o mestre nunca veria nada no header.
   *  O jogador continua se autofiltrando (comportamento inalterado) — só ele rola pela própria
   *  tela e já vê o dado caindo ali, sem precisar do header repetir. */
  ignorarFiltroPropria?: boolean,
) {
  const atual = useRolagemAoVivoStore((s) => s.atual);
  const jaReproduzidoRef = useRef<string | null>(null);
  const reproduzirRef = useRef(reproduzir);
  reproduzirRef.current = reproduzir;
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!atual || !pronto || atual.id === jaReproduzidoRef.current || (!ignorarFiltroPropria && ehRolagemPropria(atual.id))) return;
    jaReproduzidoRef.current = atual.id;
    callbacksRef.current?.aoIniciar?.(atual);
    reproduzirRef.current(atual.termos, atual.valores, { base: atual.colorsetBase, cor: atual.cor }, () => {
      callbacksRef.current?.aoTerminar?.(atual);
    });
  }, [atual, pronto, ignorarFiltroPropria]);
}
