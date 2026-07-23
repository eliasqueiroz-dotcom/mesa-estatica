import { useState } from 'react';
import FichaPublicaView from '../features/fichas/FichaPublicaView';
import NpcPublicaView from '../features/npcs/NpcPublicaView';
import SessaoPublicaView from '../features/sessao/SessaoPublicaView';
import { dividirFicha } from '../multiplayer/fichaSplit';
import { useStore } from '../state/store';

type AbaId = 'sessao' | 'personagens' | 'npcs';

const ABAS: { id: AbaId; label: string }[] = [
  { id: 'sessao', label: 'Sessão' },
  { id: 'personagens', label: 'Personagens' },
  { id: 'npcs', label: 'NPCs' },
];

/**
 * App reduzido do jogador (mesa-estatica-multiplayer-completo.md Parte IV §2, §5) — monta só as
 * `*View` de leitura. Sem `ControlPanel`, `FichaEditor`, `NpcsTab`, `MapaTab`, `DadosTab`,
 * `LogTab` de mestre; sem `#controle`. Hoje ainda lê do store local (mesma origem do `App` de
 * mestre) — vira Realtime filtrado por RLS na Fase 4 do plano (§6.4); a própria ficha do jogador
 * (editável) e o rolador próprio (`resolver-rolagem`) entram nas Fases 4–5, ainda não aqui.
 */
export default function PlayerApp() {
  const [aba, setAba] = useState<AbaId>('sessao');
  const fichas = useStore((s) => s.fichas);
  const npcs = useStore((s) => s.npcs);
  const basePV = useStore((s) => s.config.basePV);

  const npcsVisiveis = npcs.filter((n) => n.visivel);

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
      <main style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>
        {aba === 'sessao' && <SessaoPublicaView />}
        {aba === 'personagens' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {fichas.length === 0 ? (
              <p className="vazio">nenhum personagem na mesa ainda.</p>
            ) : (
              fichas.map((f) => <FichaPublicaView key={f.id} ficha={dividirFicha(f, basePV).publico} />)
            )}
          </div>
        )}
        {aba === 'npcs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {npcsVisiveis.length === 0 ? (
              <p className="vazio">nada revelado ainda.</p>
            ) : (
              npcsVisiveis.map((n) => <NpcPublicaView key={n.id} npc={n} />)
            )}
          </div>
        )}
      </main>
    </div>
  );
}
