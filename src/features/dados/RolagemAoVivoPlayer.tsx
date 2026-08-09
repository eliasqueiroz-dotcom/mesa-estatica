import { useEffect, useRef, useState } from 'react';
import { formatarNotacaoResultado, useDiceBox } from '../../dice/useDiceBox';
import { useReproduzirRolagemAoVivo } from '../../dice/useReproduzirRolagemAoVivo';
import { useRolagemAoVivoStore } from '../../state/rolagemAoVivoStore';

/** Tempo que "X está rolando…" fica visível — some assim que o dado assenta e o texto vira
 *  resultado (não precisa de graça própria, a transição já é o próprio `aoTerminar`).
 *  ~12s total (física ~2s + graça 10s) pra mesa toda ver o número. */
const GRACA_RESULTADO_MS = 10000;

/**
 * Reproduz a rolagem de outro jogador (chegou por `rolagemAoVivoSync.ts`) — montado no
 * `<header>` de `App.tsx`/`PlayerApp.tsx`, ao lado de `SoundpadPlayer`, fora das abas: resolve a
 * "lacuna 1" do item 1 do ROADMAP (nenhuma bandeja fica montada fora da aba Dados/overlay), pra
 * quem estiver em outra aba também ver o dado caindo e saber quem rolou.
 *
 * Texto evolui em duas fases: "{origem} está rolando…" enquanto a física roda, depois
 * "{origem} 1d20 → 4" (via `formatarNotacaoResultado`) quando o dado assenta — fica visível por
 * `GRACA_RESULTADO_MS` antes de sumir, tempo de ler o número.
 *
 * Bandeja própria e SEMPRE habilitada (3ª instância independente, mesmo padrão de aba
 * Dados + QuickRoll já terem cada uma a sua) — precisa estar pronta pra animar na hora que
 * chega um broadcast, sem esperar `box.initialize()`. O container fica sempre no DOM (visibility,
 * não render condicional — mesmo motivo das abas em `App.tsx`): desmontar entre rolagens
 * destruiria a instância e reintroduziria o atraso de inicialização do WebGL.
 */
export default function RolagemAoVivoPlayer() {
  const { ready, modo2D, reproduzir } = useDiceBox('dice-ao-vivo', true, 45);

  const graceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visivel, setVisivel] = useState(false);
  const [rotulo, setRotulo] = useState<{ nome: string; cor: string; texto: string } | null>(null);

  // espelha no store — é o que o destaque da aba "Dados" em App.tsx/PlayerApp.tsx lê pra saber
  // quando desligar o realce (ver comentário em rolagemAoVivoStore.ts).
  const marcarVisivel = (v: boolean) => {
    setVisivel(v);
    useRolagemAoVivoStore.getState().definirMostrando(v);
  };

  useReproduzirRolagemAoVivo(reproduzir, ready, {
    aoIniciar: (r) => {
      if (graceRef.current) clearTimeout(graceRef.current);
      setRotulo({ nome: r.origem, cor: r.cor, texto: 'está rolando…' });
      marcarVisivel(true);
    },
    aoTerminar: (r) => {
      const texto =
        r.tipo === 'surto'
          ? `d20A=${r.valores[0]} d20B=${r.valores[1]}`
          : formatarNotacaoResultado(r.termos, r.valores, r.bonus);
      setRotulo({ nome: r.origem, cor: r.cor, texto });
      graceRef.current = setTimeout(() => marcarVisivel(false), GRACA_RESULTADO_MS);
    },
  });

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
          style={{ width: 56, height: 56, background: 'var(--concrete-0)', border: '1px solid var(--concrete-2)', flexShrink: 0 }}
        />
      )}
      <span style={{ fontSize: 12, color: rotulo?.cor ?? 'var(--ink-dim)', whiteSpace: 'nowrap' }}>
        {rotulo ? `${rotulo.nome} ${rotulo.texto}` : ''}
      </span>
    </div>
  );
}
