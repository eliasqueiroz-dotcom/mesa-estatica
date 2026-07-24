import { useState } from 'react';
import DadosTabJogador from '../features/dados/DadosTabJogador';
import FichaEditor from '../features/fichas/FichaEditor';
import FichaPublicaView from '../features/fichas/FichaPublicaView';
import NpcPublicaView from '../features/npcs/NpcPublicaView';
import SessaoPublicaView from '../features/sessao/SessaoPublicaView';
import { useFichasPublicas, useHidratarSessaoPublica, useNpcsPublicos } from '../multiplayer/hidratacaoJogador';
import { useMinhaFicha } from '../multiplayer/minhaFicha';
import { useStore } from '../state/store';

type AbaId = 'sessao' | 'personagens' | 'dados' | 'npcs';

const ABAS: { id: AbaId; label: string }[] = [
  { id: 'sessao', label: 'Sessão' },
  { id: 'personagens', label: 'Personagens' },
  { id: 'dados', label: 'Dados' },
  { id: 'npcs', label: 'NPCs' },
];

/**
 * App reduzido do jogador (mesa-estatica-multiplayer-completo.md Parte IV §2, §5, Fase 6) —
 * monta só as `*View` de leitura + `FichaEditor`/rolador pra própria ficha. Sem `ControlPanel`,
 * `FichasTab`, `NpcsTab`, `MapaTab`, `DadosTab`/roladores de mestre, `LogTab`; sem `#controle`.
 * Hidratado via Realtime (§6.4) — `fichas` (dos outros)/`npcs` vêm de
 * `characters_publico`/`npcs_publico` em estado local (RLS já filtra `visivel`), `sessaoPublica`
 * e a própria ficha vão pro `useStore` compartilhado (`useMinhaFicha` — `FichaEditor` já
 * lê/escreve via esse store, reuso sem modificação). Abas por `visibility`/`pointer-events`
 * (não renderização condicional) — mesmo padrão de `App.tsx`, importante aqui porque
 * desmontar `DadosTabJogador` reinicializaria a física 3D do zero a cada troca de aba.
 */
export default function PlayerApp() {
  const [aba, setAba] = useState<AbaId>('sessao');

  useHidratarSessaoPublica();
  const { carregando, possuiFicha } = useMinhaFicha();
  const minhaFicha = useStore((s) => s.fichas.find((f) => f.id === s.fichaAtivaId) ?? null);
  const outrasFichas = useFichasPublicas().filter((f) => f.id !== minhaFicha?.id);
  const npcs = useNpcsPublicos();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 1.5rem',
          borderBottom: '1px solid var(--concrete-2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <h1 style={{ fontSize: '18px', margin: 0 }}>Estática — Mesa</h1>
          <nav style={{ display: 'flex', gap: '0.4rem' }}>
            {ABAS.map((a) => {
              const ativa = aba === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => setAba(a.id)}
                  style={
                    ativa
                      ? { borderColor: 'var(--rede)', color: 'var(--rede)', boxShadow: '0 0 0 1px var(--rede-glow)' }
                      : undefined
                  }
                >
                  {a.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>
      <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            visibility: aba === 'sessao' ? 'visible' : 'hidden',
            pointerEvents: aba === 'sessao' ? 'auto' : 'none',
            padding: '1.5rem',
            height: '100%',
            overflowY: 'auto',
          }}
        >
          <SessaoPublicaView />
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            visibility: aba === 'personagens' ? 'visible' : 'hidden',
            pointerEvents: aba === 'personagens' ? 'auto' : 'none',
            padding: '1.5rem',
            height: '100%',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {carregando ? (
              <p className="vazio">sintonizando...</p>
            ) : possuiFicha && minhaFicha ? (
              <FichaEditor ficha={minhaFicha} />
            ) : (
              <p className="vazio">link inválido ou ficha ainda não vinculada — confira com o mestre.</p>
            )}
            {outrasFichas.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {outrasFichas.map((f) => (
                  <FichaPublicaView key={f.id} ficha={f} />
                ))}
              </div>
            )}
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            visibility: aba === 'dados' ? 'visible' : 'hidden',
            pointerEvents: aba === 'dados' ? 'auto' : 'none',
            padding: '1.5rem',
            height: '100%',
            overflowY: 'auto',
          }}
        >
          {possuiFicha && minhaFicha ? (
            <DadosTabJogador ficha={minhaFicha} active={aba === 'dados'} />
          ) : (
            <p className="vazio">sem ficha vinculada — nada pra rolar.</p>
          )}
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            visibility: aba === 'npcs' ? 'visible' : 'hidden',
            pointerEvents: aba === 'npcs' ? 'auto' : 'none',
            padding: '1.5rem',
            height: '100%',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {npcs.length === 0 ? (
              <p className="vazio">nada revelado ainda.</p>
            ) : (
              npcs.map((n) => <NpcPublicaView key={n.id} npc={n} />)
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
