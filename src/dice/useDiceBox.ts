import { useEffect, useRef, useState } from 'react';
import DiceBox, { type RollResults } from '@3d-dice/dice-box-threejs';
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

export function useDiceBox(containerId: string, enabled = true) {
  const boxRef = useRef<DiceBox | null>(null);
  const [ready, setReady] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [rolando, setRolando] = useState(false);
  /** espelho síncrono de `rolando` — a lib não enfileira roll() concorrente (ver rolar() abaixo),
   *  então o guard de "já tem uma rolagem em andamento" precisa ser lido antes do setState assentar. */
  const rolandoRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      setErro(null);
      boxRef.current?.clearDice();
      boxRef.current = null;
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
      // números em âmbar vivo sobre corpo ciano frio (ver arte.md)
      theme_customColorset: {
        background: '#2a6d78',
        foreground: '#ffc400',
        outline: '#0b0d11',
        texture: 'glass',
        material: 'glass',
      },
      sounds: false,
      shadows: true,
    });
    boxRef.current = box;

    const iniciar = async () => {
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
      await box.initialize();
      if (vivo) setReady(true);
    };

    iniciar().catch((e: unknown) => {
      if (vivo) setErro(String(e));
    });

    return () => {
      vivo = false;
      boxRef.current = null;
      container.replaceChildren();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId, enabled]);

  const rolar = (
    notacao: string | RollTermo | RollTermo[],
    onComplete: (grupos: GrupoResultado[]) => void,
  ) => {
    const box = boxRef.current;
    // a lib não protege roll() concorrente: uma segunda chamada enquanto a primeira ainda anima
    // reescreve notationVectors/diceList (estado único da instância) e derruba o resultado da
    // primeira — por isso o cadeado é aqui, no único ponto que os 5 roladores compartilham.
    if (!box || rolandoRef.current) return;
    rolandoRef.current = true;
    setRolando(true);
    const termos = normalizarTermos(notacao);
    box
      .roll(montarNotacao(termos))
      .then((r) => onComplete(paraGrupos(r)))
      .catch((e: unknown) => setErro(String(e)))
      .finally(() => {
        rolandoRef.current = false;
        setRolando(false);
      });
  };

  return { ready, erro, rolando, rolar };
}
