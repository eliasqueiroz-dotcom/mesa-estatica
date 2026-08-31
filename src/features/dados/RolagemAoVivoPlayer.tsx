import { useEffect, useRef, useState } from 'react';
import { formatarHeaderRolagem, type GrupoDados, type RollTermo, useDiceBox } from '../../dice/useDiceBox';
import { useReproduzirRolagemAoVivo } from '../../dice/useReproduzirRolagemAoVivo';
import { useRolagemAoVivoStore } from '../../state/rolagemAoVivoStore';

/** Fatia `valores` (achatado, na ordem dos termos) pelos `qty` de cada termo — reconstrói os
 *  grupos que `formatarHeaderRolagem` espera a partir do shape plano do broadcast. */
function agruparPorTermo(termos: RollTermo[], valores: number[]): GrupoDados[] {
  let cursor = 0;
  return termos.map((t) => {
    const resultados = valores.slice(cursor, cursor + t.qty);
    cursor += t.qty;
    return { notacao: `${t.qty}d${t.sides}`, resultados };
  });
}

/** Tempo que "X está rolando…" fica visível — some assim que o dado assenta e o texto vira
 *  resultado (não precisa de graça própria, a transição já é o próprio `aoTerminar`).
 *  ~18s total (física ~2s + graça 16s) pra mesa toda ver o número — verificado ao vivo com 2
 *  clientes reais que a rolagem ao vivo chega corretamente (broadcast + recepção funcionam), mas
 *  10s de graça era curto demais pra alguém trocar de tela (mestre → jogador, ou entre dois
 *  jogadores) a tempo de notar antes de sumir. */
const GRACA_RESULTADO_MS = 16000;

/**
 * Reproduz a rolagem de outro jogador (chegou por `rolagemAoVivoSync.ts`) — montado no
 * `<header>` de `App.tsx`/`PlayerApp.tsx`, ao lado de `SoundpadPlayer`, fora das abas: resolve a
 * "lacuna 1" do item 1 do ROADMAP (nenhuma bandeja fica montada fora da aba Dados/overlay), pra
 * quem estiver em outra aba também ver o dado caindo e saber quem rolou.
 *
 * Texto evolui em duas fases: "{origem} está rolando…" enquanto a física roda, depois
 * "{origem}: 1d20 → [4] = 4" (via `formatarHeaderRolagem`) quando o dado assenta — fica visível
 * por `GRACA_RESULTADO_MS` antes de sumir, tempo de ler o número.
 *
 * Bandeja própria e SEMPRE habilitada (3ª instância independente, mesmo padrão de aba
 * Dados + QuickRoll já terem cada uma a sua) — precisa estar pronta pra animar na hora que
 * chega um broadcast, sem esperar `box.initialize()`. O container fica sempre no DOM (visibility,
 * não render condicional — mesmo motivo das abas em `App.tsx`): desmontar entre rolagens
 * destruiria a instância e reintroduziria o atraso de inicialização do WebGL.
 */
interface Props {
  /** true só em `App.tsx` (header do mestre) — ver comentário em `useReproduzirRolagemAoVivo.ts`. */
  verProprias?: boolean;
}

export default function RolagemAoVivoPlayer({ verProprias }: Props) {
  const { ready, modo2D, reproduzir } = useDiceBox('dice-ao-vivo', true, 45);

  const graceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visivel, setVisivel] = useState(false);
  const [rotulo, setRotulo] = useState<{ cor: string; texto: string } | null>(null);

  // espelha no store — é o que o destaque da aba "Dados" em App.tsx/PlayerApp.tsx lê pra saber
  // quando desligar o realce (ver comentário em rolagemAoVivoStore.ts).
  const marcarVisivel = (v: boolean) => {
    setVisivel(v);
    useRolagemAoVivoStore.getState().definirMostrando(v);
  };

  useReproduzirRolagemAoVivo(reproduzir, ready, {
    aoIniciar: (r) => {
      if (graceRef.current) clearTimeout(graceRef.current);
      setRotulo({ cor: r.cor, texto: `${r.origem} está rolando…` });
      marcarVisivel(true);
    },
    aoTerminar: (r) => {
      // Surto: 2d20 comparados, não termos da notação — grupo único fixo em vez de `agruparPorTermo`.
      const grupos: GrupoDados[] = r.tipo === 'surto' ? [{ notacao: '2d20', resultados: r.valores }] : agruparPorTermo(r.termos, r.valores);
      const total = grupos.flatMap((g) => g.resultados).reduce((soma, v) => soma + v, 0) + (r.bonus ?? 0);
      const texto = formatarHeaderRolagem({ quem: r.origem, grupos, bonus: r.bonus, total });
      setRotulo({ cor: r.cor, texto });
      graceRef.current = setTimeout(() => marcarVisivel(false), GRACA_RESULTADO_MS);
    },
  }, verProprias);

  useEffect(
    () => () => {
      if (graceRef.current) clearTimeout(graceRef.current);
    },
    [],
  );

  return (
    <div
      className="mono"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        overflow: 'hidden',
        visibility: visivel ? 'visible' : 'hidden',
        width: visivel ? undefined : 0,
      }}
    >
      {!modo2D && (
        <div
          id="dice-ao-vivo"
          style={{
            width: 60,
            height: 60,
            background: 'var(--concrete-0)',
            border: '1px solid var(--concrete-2)',
            flexShrink: 0,
            position: 'relative',
            overflow: 'hidden',
          }}
        />
      )}
      <span style={{ fontSize: 12, color: rotulo?.cor ?? 'var(--ink-dim)', whiteSpace: 'nowrap' }}>
        {rotulo?.texto ?? ''}
      </span>
    </div>
  );
}
