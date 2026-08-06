import { useEffect, useRef, useState } from 'react';
import DiceBox, { type RollResults } from '@3d-dice/dice-box-threejs';
import { COLORSETS, type ColorsetId } from './colorsets';
import { resolverRolagemRemota } from '../multiplayer/rolagemRemota';

/** Termo de rolagem — ex: { sides: 20, qty: 2 } = 2d20. */
export interface RollTermo {
  sides: number;
  qty: number;
}

/** Shape agrupado que os roladores consomem (mantido da lib anterior p/ não reescrever a UI). */
export interface GrupoResultado {
  qty: number;
  sides: number;
  value: number; // total do grupo
  rolls: { value: number }[];
}

/** Alias de compatibilidade — os roladores foram escritos contra este nome. */
export type RollGroupResult = GrupoResultado;

function normalizarTermos(notacao: string | RollTermo | RollTermo[]): RollTermo[] {
  if (typeof notacao === 'string') {
    return notacao.split('+').map((parte) => {
      const [qty, sides] = parte.trim().toLowerCase().split('d').map(Number);
      return { qty: qty || 1, sides };
    });
  }
  return Array.isArray(notacao) ? notacao : [notacao];
}

/**
 * Monta a notação da lib. Rolagem honesta por padrão: "1d8+1d20".
 *
 * Se o mestre tiver enfileirado valores forçados (janela de controle, ver forcarRolagem.ts),
 * anexa "@v1,v2,..." — a lib faz swap da face pra cair no valor, indistinguível de uma rolagem real.
 *
 * IMPORTANTE: o "@" só pode aparecer UMA VEZ, no final de toda a notação combinada — nunca um "@"
 * por termo. O parser da lib (`parseNotation`) faz `notacao.split("@")` sem limite: tudo que vem
 * depois do PRIMEIRO "@" vira a lista de valores forçados, e qualquer coisa depois de um segundo
 * "@" quebra a leitura — um termo como "1d20@5+1d4@1" faz o "+1d4" inteiro ser absorvido como texto
 * de valores forçados em vez de virar um dado de verdade, e ele nunca chega a ser criado na cena
 * (achado ao investigar por que o dado de Sanidade sumia da bandeja ao forçar valores múltiplos).
 * Os valores forçados são aplicados por ÍNDICE, na ordem em que os dados são criados — que segue a
 * ordem dos termos na notação (1º termo primeiro, etc.), então a ordem de `termos` aqui precisa
 * bater com a ordem que o valor forçado pretende atingir.
 */
export type ResolverRemoto = (termos: RollTermo[], personagemId: string | null) => Promise<number[] | null>;

/** Consome a fila local de forçados (`forcarRolagem.ts`). Injetável de propósito: este módulo
 *  (`useDiceBox`) é compartilhado entre mestre e jogador, e `forcarRolagem.ts` abre um
 *  BroadcastChannel com a fila secreta do mestre — importá-lo aqui direto o colocaria no bundle
 *  do jogador mesmo sem uso real (o Rollup não consegue tree-shakear uma referência de código,
 *  só o default no-op fica no caminho do jogador). Cada chamador do mestre passa a função real;
 *  o jogador não passa nada. */
export type ConsumirForcadosFn = (totalDados: number, personagemId: string | null) => number[] | null;
const semForcados: ConsumirForcadosFn = () => null;

export async function montarNotacao(
  termos: RollTermo[],
  personagemId: string | null = null,
  resolverRemoto: ResolverRemoto = resolverRolagemRemota,
  consumirForcadosFn: ConsumirForcadosFn = semForcados,
): Promise<string> {
  const base = termos.map((t) => `${t.qty}d${t.sides}`).join('+');
  const totalDados = termos.reduce((n, t) => n + t.qty, 0);
  // Fase D (desligada por padrão — ver rolagemRemota.ts): tenta o servidor primeiro; null
  // cai pro caminho local de sempre (fila local via BroadcastChannel, honesto se vazia).
  // `resolverRemoto` é injetável — o PlayerApp usa `resolverRolagemJogador` (sempre tenta o
  // servidor, sem o gate da flag) em vez do padrão do mestre.
  const forcados = (await resolverRemoto(termos, personagemId)) ?? consumirForcadosFn(totalDados, personagemId);
  if (!forcados) return base;
  return `${base}@${forcados.join(',')}`;
}

function paraGrupos(r: RollResults): GrupoResultado[] {
  return r.sets.map((s) => ({
    qty: s.num,
    sides: s.sides,
    value: s.total,
    rolls: s.rolls.map((roll) => ({ value: roll.value })),
  }));
}

/**
 * Rolagem por matemática pura (Math.random), sem física nem visual 3D — usada quando o WebGL
 * não inicializa (GPU indisponível, driver bloqueado, etc.). Mantém o mesmo shape de resultado
 * dos roladores e ainda respeita valores forçados da janela de controle, pela mesma ordem
 * (1º termo primeiro) que a rolagem física usaria — só sem o dado caindo na tela. Async pelo
 * mesmo motivo de `montarNotacao`: tenta o servidor primeiro (Fase D), cai pro local se a flag
 * estiver desligada ou a chamada falhar.
 */
export async function rolarFallback2D(
  termos: RollTermo[],
  personagemId: string | null = null,
  resolverRemoto: ResolverRemoto = resolverRolagemRemota,
  consumirForcadosFn: ConsumirForcadosFn = semForcados,
): Promise<GrupoResultado[]> {
  const totalDados = termos.reduce((n, t) => n + t.qty, 0);
  const forcados = (await resolverRemoto(termos, personagemId)) ?? consumirForcadosFn(totalDados, personagemId);
  let cursor = 0;
  return termos.map((t) => {
    const rolls: { value: number }[] = [];
    for (let i = 0; i < t.qty; i++) {
      const valor = forcados?.[cursor] ?? Math.floor(Math.random() * t.sides) + 1;
      rolls.push({ value: valor });
      cursor++;
    }
    return { qty: t.qty, sides: t.sides, value: rolls.reduce((soma, r) => soma + r.value, 0), rolls };
  });
}

interface PedidoRolagem {
  termos: RollTermo[];
  onComplete: (grupos: GrupoResultado[]) => void;
  colorset: ColorsetId;
  personagemId: string | null;
}

export function useDiceBox(
  containerId: string,
  enabled = true,
  baseScale = 100,
  resolverRemoto: ResolverRemoto = resolverRolagemRemota,
  consumirForcadosFn: ConsumirForcadosFn = semForcados,
) {
  const boxRef = useRef<DiceBox | null>(null);
  const [ready, setReady] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [rolando, setRolando] = useState(false);
  /** true quando box.initialize() falhou (sem WebGL, GPU bloqueada, etc.) — rolar() passa a usar
   *  rolarFallback2D em vez de tentar física. A ferramenta continua funcionando, só sem o visual. */
  const [modo2D, setModo2D] = useState(false);
  /** espelho síncrono de `rolando` — a lib não enfileira roll() concorrente (ver rolar() abaixo),
   *  então o guard de "já tem uma rolagem em andamento" precisa ser lido antes do setState assentar. */
  const rolandoRef = useRef(false);
  /** evita chamar updateConfig (recarrega tema) toda rolagem — só quando o colorset pedido muda. */
  const colorsetAtualRef = useRef<ColorsetId>('rede');
  /** fila de rolagens pedidas enquanto a bandeja já estava ocupada — tocam sozinhas, em ordem,
   *  assim que a rolagem em andamento assenta. Nenhum clique se perde. */
  const filaRef = useRef<PedidoRolagem[]>([]);

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      setErro(null);
      setModo2D(false);
      boxRef.current?.clearDice();
      boxRef.current = null;
      filaRef.current = [];
      rolandoRef.current = false;
      document.getElementById(containerId)?.replaceChildren();
      return;
    }

    let vivo = true;
    const container = document.getElementById(containerId);
    if (!container) {
      setErro('container dos dados não encontrado');
      return;
    }

    const box = new DiceBox(`#${containerId}`, {
      assetPath: '/assets/dice-box-threejs/',
      theme_surface: 'green-felt',
      theme_material: 'glass',
      theme_customColorset: COLORSETS.rede,
      baseScale,
      sounds: false,
      shadows: true,
    });
    boxRef.current = box;
    colorsetAtualRef.current = 'rede';

    const iniciar = async () => {
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
      await box.initialize();
      if (vivo) setReady(true);
    };

    iniciar().catch((e: unknown) => {
      // WebGL indisponível ou falha de inicialização — cai pro modo 2D em vez de travar a
      // ferramenta. `ready` fica true porque os roladores ficam usáveis mesmo sem física.
      if (vivo) {
        setErro(String(e));
        setModo2D(true);
        setReady(true);
      }
    });

    return () => {
      vivo = false;
      boxRef.current = null;
      container.replaceChildren();
    };
  }, [containerId, enabled, baseScale]);

  // a lib não protege roll() concorrente: uma segunda chamada enquanto a primeira ainda anima
  // reescreve notationVectors/diceList (estado único da instância) e derruba o resultado da
  // primeira — por isso só UMA chamada real de roll() está em voo por vez. Pedidos que chegam
  // nesse meio-tempo entram na fila e tocam sozinhos, em ordem, sem o mestre precisar clicar de novo.
  const executarRolagem = async (pedido: PedidoRolagem) => {
    const box = boxRef.current;
    if (!box) {
      filaRef.current = [];
      rolandoRef.current = false;
      setRolando(false);
      return;
    }
    try {
      // só recarrega o tema se o colorset pedido for diferente do atual — updateConfig é async
      // e refaz o loadTheme, então evitar isso em toda rolagem honesta (padrão 'rede').
      if (pedido.colorset !== colorsetAtualRef.current) {
        await box.updateConfig({ theme_customColorset: COLORSETS[pedido.colorset] });
        colorsetAtualRef.current = pedido.colorset;
      }
      const notacao = await montarNotacao(pedido.termos, pedido.personagemId, resolverRemoto, consumirForcadosFn);
      const r = await box.roll(notacao);
      pedido.onComplete(paraGrupos(r));
    } catch (e: unknown) {
      setErro(String(e));
    } finally {
      const proximo = filaRef.current.shift();
      if (proximo) {
        void executarRolagem(proximo);
      } else {
        rolandoRef.current = false;
        setRolando(false);
      }
    }
  };

  const rolar = (
    notacao: string | RollTermo | RollTermo[],
    onComplete: (grupos: GrupoResultado[]) => void,
    colorset: ColorsetId = 'rede',
    personagemId: string | null = null,
  ) => {
    const termos = normalizarTermos(notacao);
    if (modo2D) {
      // sem física rodando, então sem concorrência real pra proteger — resolve na hora (async
      // por dentro só pra poder tentar o servidor primeiro; onComplete dispara quando chegar).
      void rolarFallback2D(termos, personagemId, resolverRemoto, consumirForcadosFn).then(onComplete);
      return;
    }
    if (!boxRef.current) return;
    const pedido: PedidoRolagem = { termos, onComplete, colorset, personagemId };
    if (rolandoRef.current) {
      filaRef.current.push(pedido);
      return;
    }
    rolandoRef.current = true;
    setRolando(true);
    void executarRolagem(pedido);
  };

  return { ready, erro, rolando, modo2D, rolar };
}
