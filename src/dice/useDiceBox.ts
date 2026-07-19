import { useEffect, useRef, useState } from 'react';
import DiceBox, { type RollResults } from '@3d-dice/dice-box-threejs';
import { COLORSETS, type ColorsetId } from './colorsets';
import { consumirForcados } from './forcarRolagem';

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
export function montarNotacao(termos: RollTermo[]): string {
  const base = termos.map((t) => `${t.qty}d${t.sides}`).join('+');
  const totalDados = termos.reduce((n, t) => n + t.qty, 0);
  const forcados = consumirForcados(totalDados);
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
 * (1º termo primeiro) que a rolagem física usaria — só sem o dado caindo na tela.
 */
export function rolarFallback2D(termos: RollTermo[]): GrupoResultado[] {
  const totalDados = termos.reduce((n, t) => n + t.qty, 0);
  const forcados = consumirForcados(totalDados);
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
}

export function useDiceBox(containerId: string, enabled = true) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId, enabled]);

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
      const r = await box.roll(montarNotacao(pedido.termos));
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
  ) => {
    const termos = normalizarTermos(notacao);
    if (modo2D) {
      // sem física rodando, então sem concorrência real pra proteger — resolve na hora.
      onComplete(rolarFallback2D(termos));
      return;
    }
    if (!boxRef.current) return;
    const pedido: PedidoRolagem = { termos, onComplete, colorset };
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
