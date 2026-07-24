import { useState } from 'react';
import FichaEditor from '../features/fichas/FichaEditor';
import FichaPublicaView from '../features/fichas/FichaPublicaView';
import NpcPublicaView from '../features/npcs/NpcPublicaView';
import SessaoPublicaView from '../features/sessao/SessaoPublicaView';
import { useFichasPublicas, useHidratarSessaoPublica, useNpcsPublicos } from '../multiplayer/hidratacaoJogador';
import { useMinhaFicha } from '../multiplayer/minhaFicha';
import { useStore } from '../state/store';

type AbaId = 'sessao' | 'personagens' | 'npcs';

const ABAS: { id: AbaId; label: string }[] = [
  { id: 'sessao', label: 'Sessão' },
  { id: 'personagens', label: 'Personagens' },
  { id: 'npcs', label: 'NPCs' },
];

/**
 * App reduzido do jogador (mesa-estatica-multiplayer-completo.md Parte IV §2, §5) — monta só as
 * `*View` de leitura + `FichaEditor` pra própria ficha. Sem `ControlPanel`, `FichasTab`,
 * `NpcsTab`, `MapaTab`, `DadosTab`, `LogTab` de mestre; sem `#controle`. Hidratado via Realtime
 * (§6.4) — `fichas` (dos outros)/`npcs` vêm de `characters_publico`/`npcs_publico` em estado
 * local (RLS já filtra `visivel`), `sessaoPublica` e a própria ficha vão pro `useStore`
 * compartilhado (`useMinhaFicha` — `FichaEditor`/`AtributosDerivadosSection`/`DinheiroSection`
 * já leem/escrevem via esse store, reuso sem modificação). Rolador próprio
 * (`resolver-rolagem`) ainda não entra aqui — Fase 6 do plano.
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
      <main style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>
        {aba === 'sessao' && <SessaoPublicaView />}
        {aba === 'personagens' && (
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
        )}
        {aba === 'npcs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {npcs.length === 0 ? (
              <p className="vazio">nada revelado ainda.</p>
            ) : (
              npcs.map((n) => <NpcPublicaView key={n.id} npc={n} />)
            )}
          </div>
        )}
      </main>
    </div>
  );
}
