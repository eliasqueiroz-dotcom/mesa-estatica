import { useEffect, useState } from 'react';
import DadosTabJogador from '../features/dados/DadosTabJogador';
import QuickRollOverlayJogador from '../features/dados/QuickRollOverlayJogador';
import FichaEditor from '../features/fichas/FichaEditor';
import FichaPublicaView from '../features/fichas/FichaPublicaView';
import CombateJogadorView from '../features/iniciativa/CombateJogadorView';
import MapaJogadorView from '../features/mapa/MapaJogadorView';
import MidiaJogadorView from '../features/midia/MidiaJogadorView';
import MidiaPlayerJogador from '../features/midia/MidiaPlayerJogador';
import NpcPublicaView from '../features/npcs/NpcPublicaView';
import RuidoOverlay from '../features/ruido/RuidoOverlay';
import SessaoPublicaView from '../features/sessao/SessaoPublicaView';
import { iniciarAuthMultiplayer } from '../multiplayer/auth';
import {
  useFichasPublicas,
  useHidratarMapaPublico,
  useHidratarMidia,
  useHidratarSessaoPublica,
  useIniciativaPublica,
  useNpcsPublicos,
} from '../multiplayer/hidratacaoJogador';
import { iniciarSyncLogRolls } from '../multiplayer/logRollsSync';
import { useMinhaFicha } from '../multiplayer/minhaFicha';
import { iniciarSyncTokens } from '../multiplayer/tokensSync';
import { useStore } from '../state/store';
import LogTabJogador from './LogTabJogador';

type AbaId = 'sessao' | 'personagens' | 'dados' | 'npcs' | 'mapa' | 'midia' | 'log';

const ABAS: { id: AbaId; label: string }[] = [
  { id: 'sessao', label: 'Sessão' },
  { id: 'personagens', label: 'Personagens' },
  { id: 'dados', label: 'Dados' },
  { id: 'npcs', label: 'NPCs & Combate' },
  { id: 'mapa', label: 'Mapa' },
  { id: 'midia', label: 'Mídia' },
  { id: 'log', label: 'Log' },
];

/**
 * App reduzido do jogador (mesa-estatica-multiplayer-completo.md Parte IV §2, §5, Fase 6) —
 * monta só as `*View` de leitura + `FichaEditor`/roladores/`QuickRollOverlayJogador` pra
 * própria ficha. Sem `ControlPanel`, `FichasTab`, `NpcsTab`, `MapaTab`, `DadosTab`/roladores de
 * mestre, `LogTab`; sem `#controle`. Hidratado via Realtime (§6.4) — `fichas` (dos
 * outros)/`npcs` vêm de `characters_publico`/`npcs_publico` em estado local (RLS já filtra
 * `visivel`), `sessaoPublica` e a própria ficha vão pro `useStore` compartilhado
 * (`useMinhaFicha` — `FichaEditor` já lê/escreve via esse store, reuso sem modificação). Abas
 * por `visibility`/`pointer-events` (não renderização condicional) — mesmo padrão de
 * `App.tsx`, importante aqui porque desmontar `DadosTabJogador` reinicializaria a física 3D
 * do zero a cada troca de aba.
 */
export default function PlayerApp() {
  const [aba, setAba] = useState<AbaId>('sessao');
  const [overlayAberto, setOverlayAberto] = useState(false);
  const [pedidosRolagemRapida, setPedidosRolagemRapida] = useState(0);

  useHidratarSessaoPublica();
  useHidratarMapaPublico();
  useHidratarMidia();
  const { carregando, possuiFicha } = useMinhaFicha();
  const minhaFicha = useStore((s) => s.fichas.find((f) => f.id === s.fichaAtivaId) ?? null);
  const outrasFichas = useFichasPublicas().filter((f) => f.id !== minhaFicha?.id);
  const npcs = useNpcsPublicos();
  const iniciativa = useIniciativaPublica();

  // sync de tokens (posição no mapa) + log/rolagens — mesmos módulos do GmApp (App.tsx), RLS
  // ainda aberta pra `tokens` desde a Fase A; gated pela mesma auth anônima que `useMinhaFicha`
  // já dispara.
  useEffect(() => {
    let pararTokens = () => {};
    let pararLogRolls = () => {};
    let cancelado = false;
    iniciarAuthMultiplayer().then(() => {
      if (cancelado) return;
      pararTokens = iniciarSyncTokens();
      pararLogRolls = iniciarSyncLogRolls();
    });
    return () => {
      cancelado = true;
      pararTokens();
      pararLogRolls();
    };
  }, []);

  // atalhos: 1-7 trocam de aba, R abre a rolagem rápida e já rola, S só abre o painel —
  // mesmo padrão de App.tsx, ignorado enquanto o foco está num campo de texto.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      const digitando =
        alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT' || alvo.isContentEditable);
      if (digitando || e.ctrlKey || e.altKey || e.metaKey) return;

      const indiceAba = '1234567'.indexOf(e.key);
      if (indiceAba !== -1) {
        setAba(ABAS[indiceAba].id);
        return;
      }
      const tecla = e.key.toLowerCase();
      if (tecla === 'r') {
        setOverlayAberto((prev) => {
          if (!prev) return true;
          setPedidosRolagemRapida((n) => n + 1);
          return true;
        });
      } else if (tecla === 'x') {
        setOverlayAberto(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <RuidoOverlay />
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
            visibility: aba === 'mapa' ? 'visible' : 'hidden',
            pointerEvents: aba === 'mapa' ? 'auto' : 'none',
            height: '100%',
          }}
        >
          {possuiFicha && minhaFicha ? (
            <MapaJogadorView minhaFicha={minhaFicha} outrasFichas={outrasFichas} npcs={npcs} iniciativa={iniciativa} />
          ) : (
            <p className="vazio" style={{ padding: '1.5rem' }}>
              sem ficha vinculada — sem token pra mostrar no mapa.
            </p>
          )}
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            visibility: aba === 'midia' ? 'visible' : 'hidden',
            pointerEvents: aba === 'midia' ? 'auto' : 'none',
            height: '100%',
          }}
        >
          <MidiaJogadorView />
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
            {minhaFicha && <CombateJogadorView iniciativa={iniciativa} minhaFichaId={minhaFicha.id} />}
            {npcs.length === 0 ? (
              <p className="vazio">nada revelado ainda.</p>
            ) : (
              npcs.map((n) => <NpcPublicaView key={n.id} npc={n} />)
            )}
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            visibility: aba === 'log' ? 'visible' : 'hidden',
            pointerEvents: aba === 'log' ? 'auto' : 'none',
            height: '100%',
            overflowY: 'auto',
          }}
        >
          <LogTabJogador />
        </div>
      </main>
      <MidiaPlayerJogador />
      {possuiFicha && minhaFicha && (
        <QuickRollOverlayJogador
          ficha={minhaFicha}
          abaAtual={aba}
          aberto={overlayAberto}
          onAbertoChange={setOverlayAberto}
          pedidoRolagem={pedidosRolagemRapida}
        />
      )}
    </div>
  );
}
