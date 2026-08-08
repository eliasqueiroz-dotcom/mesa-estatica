import { useEffect, useRef, useState } from 'react';
import { useDiceBox } from '../../dice/useDiceBox';
import { useRolagemAoVivoStore } from '../../state/rolagemAoVivoStore';

/** Tempo que o aviso "X está rolando" fica visível depois do dado assentar — dá tempo de ler
 *  o nome antes de sumir, sem virar um elemento permanente no header. */
const GRACA_MS = 1000;

/**
 * Reproduz a rolagem de outro jogador (chegou por `rolagemAoVivoSync.ts`) — montado no
 * `<header>` de `App.tsx`/`PlayerApp.tsx`, ao lado de `SoundpadPlayer`, fora das abas: resolve a
 * "lacuna 1" do item 1 do ROADMAP (nenhuma bandeja fica montada fora da aba Dados/overlay), pra
 * quem estiver em outra aba também ver o dado caindo e saber quem rolou.
 *
 * Bandeja própria e SEMPRE habilitada (3ª instância independente, mesmo padrão de aba
 * Dados + QuickRoll já terem cada uma a sua) — precisa estar pronta pra animar na hora que
 * chega um broadcast, sem esperar `box.initialize()`. O container fica sempre no DOM (visibility,
 * não render condicional — mesmo motivo das abas em `App.tsx`): desmontar entre rolagens
 * destruiria a instância e reintroduziria o atraso de inicialização do WebGL.
 *
 * Dedupe por `id`: cada rolagem ao vivo nasce com um uuid novo (`crypto.randomUUID()` no
 * wrapper `rolarEBroadcast`), então basta guardar o último `id` já reproduzido pra nunca
 * reanimar o mesmo evento (ex.: reconexão do canal).
 */
export default function RolagemAoVivoPlayer() {
  const { ready, modo2D, reproduzir } = useDiceBox('dice-ao-vivo', true, 45);
  const atual = useRolagemAoVivoStore((s) => s.atual);

  const jaReproduzidoRef = useRef<string | null>(null);
  const reproduzirRef = useRef(reproduzir);
  reproduzirRef.current = reproduzir;
  const graceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [visivel, setVisivel] = useState(false);
  const [rotulo, setRotulo] = useState<{ nome: string; cor: string } | null>(null);

  useEffect(() => {
    if (!atual || !ready || atual.id === jaReproduzidoRef.current) return;
    jaReproduzidoRef.current = atual.id;
    if (graceRef.current) clearTimeout(graceRef.current);

    setRotulo({ nome: atual.origem, cor: atual.cor });
    setVisivel(true);
    reproduzirRef.current(atual.termos, atual.valores, { base: atual.colorsetBase, cor: atual.cor }, () => {
      graceRef.current = setTimeout(() => setVisivel(false), GRACA_MS);
    });
  }, [atual, ready]);

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
        {rotulo ? `${rotulo.nome} está rolando…` : ''}
      </span>
    </div>
  );
}
