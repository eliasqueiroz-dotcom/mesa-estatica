import { useEffect, useRef, useState } from 'react';
import DadosTab from '../features/dados/DadosTab';
import QuickRollOverlay from '../features/dados/QuickRollOverlay';
import FichasTab from '../features/fichas/FichasTab';
import MapaTab from '../features/mapa/MapaTab';
import MidiaPlayerGM from '../features/midia/MidiaPlayerGM';
import MidiaTab from '../features/midia/MidiaTab';
import VinculoMestre from '../features/multiplayer/VinculoMestre';
import NpcsTab from '../features/npcs/NpcsTab';
import RuidoOverlay from '../features/ruido/RuidoOverlay';
import AlertaOverlay from '../features/sessao/AlertaOverlay';
import DestaqueSuperior from '../features/sessao/DestaqueSuperior';
import SessaoTab from '../features/sessao/SessaoTab';
import { useStore } from '../state/store';
import { iniciarAuthMultiplayer } from '../multiplayer/auth';
import { iniciarSyncFichas } from '../multiplayer/fichasSync';
import { iniciarSyncIniciativa } from '../multiplayer/iniciativaSync';
import { iniciarSyncLogRolls } from '../multiplayer/logRollsSync';
import { iniciarSyncMapaPublico } from '../multiplayer/mapaPublicoSync';
import { iniciarSyncMidiaEstado } from '../multiplayer/midiaEstadoSync';
import { iniciarSyncMidiaFaixas } from '../multiplayer/midiaFaixasSync';
import { iniciarSyncNpcs } from '../multiplayer/npcsSync';
import { iniciarSyncSessaoPublica } from '../multiplayer/sessaoPublicaSync';
import { iniciarSyncTokens } from '../multiplayer/tokensSync';
import LogTab from './LogTab';

const ATALHOS: Record<string, string> = {
  sessao: '1',
  personagens: '2',
  dados: '3',
  mapa: '4',
  npcs: '5',
  log: '6',
  midia: '7',
};

type AbaId = 'sessao' | 'personagens' | 'dados' | 'mapa' | 'npcs' | 'log' | 'midia';

const ABAS: { id: AbaId; label: string }[] = [
  { id: 'sessao', label: 'Sessão' },
  { id: 'personagens', label: 'Personagens' },
  { id: 'dados', label: 'Dados & Regras' },
  { id: 'mapa', label: 'Mapa' },
  { id: 'npcs', label: 'NPCs & Iniciativa' },
  { id: 'log', label: 'Log' },
  { id: 'midia', label: 'Mídia' },
];

function ExportarImportar({ abrirControle }: { abrirControle: () => void }) {
  const exportarJSON = useStore((s) => s.exportarJSON);
  const importarJSON = useStore((s) => s.importarJSON);
  const inputRef = useRef<HTMLInputElement>(null);

  const exportar = () => {
    const blob = new Blob([exportarJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estatica-mesa-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    arquivo.text().then((texto) => {
      try {
        importarJSON(texto);
      } catch {
        window.alert('sinal corrompido — não foi possível ler esse arquivo.');
      }
    });
    e.target.value = '';
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
      <span className="mono" style={{ fontSize: '11px', color: 'var(--rede)' }} title="salva a cada alteração — localStorage deste navegador">
        ● registrado
      </span>
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <button onClick={exportar} title="confie no papel, não na nuvem">
          exportar
        </button>
        <button onClick={() => inputRef.current?.click()}>importar</button>
        {/* botão de controle agora oculto; o controle é acessível clicando no título principal */}
        <button onClick={abrirControle} title="janela secreta do mestre — não compartilhar" style={{ display: 'none' }}>
          controle
        </button>
        <input ref={inputRef} type="file" accept="application/json" hidden onChange={importar} />
      </div>
    </div>
  );
}

export default function App() {
  const [aba, setAba] = useState<AbaId>('personagens');
  const [overlayAberto, setOverlayAberto] = useState(false);
  const [pedidosRolagemRapida, setPedidosRolagemRapida] = useState(0);

  const abrirControle = () => {
    window.open(
      `${location.origin}${location.pathname}#controle`,
      'estatica-controle',
      'width=620,height=760',
    );
  };

  // Multiplayer Fases A+B (mesa-estatica-multiplayer-completo.md §11): sessão anônima +
  // vínculo por URL primeiro, sync de tokens/fichas/npcs/sessão/iniciativa via Supabase
  // Realtime depois — nessa ordem, pra RLS já enxergar auth.uid() na primeira assinatura.
  // Vira no-op sem env vars.
  useEffect(() => {
    let pararTokens = () => {};
    let pararFichas = () => {};
    let pararNpcs = () => {};
    let pararSessaoPublica = () => {};
    let pararIniciativa = () => {};
    let pararMapaPublico = () => {};
    let pararMidiaFaixas = () => {};
    let pararMidiaEstado = () => {};
    let pararLogRolls = () => {};
    let cancelado = false;
    iniciarAuthMultiplayer().then(() => {
      if (cancelado) return;
      pararTokens = iniciarSyncTokens();
      pararFichas = iniciarSyncFichas();
      pararNpcs = iniciarSyncNpcs();
      pararSessaoPublica = iniciarSyncSessaoPublica();
      pararIniciativa = iniciarSyncIniciativa();
      pararMapaPublico = iniciarSyncMapaPublico();
      pararMidiaFaixas = iniciarSyncMidiaFaixas();
      pararMidiaEstado = iniciarSyncMidiaEstado();
      pararLogRolls = iniciarSyncLogRolls();
    });
    return () => {
      cancelado = true;
      pararTokens();
      pararFichas();
      pararNpcs();
      pararSessaoPublica();
      pararIniciativa();
      pararMapaPublico();
      pararMidiaFaixas();
      pararMidiaEstado();
      pararLogRolls();
    };
  }, []);

  // atalhos: 1–6 trocam de aba, R abre a rolagem rápida e já rola, S só abre o painel.
  // ignorados enquanto o foco está num campo de texto (senão digitar "1" numa ficha trocaria de aba).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      const digitando =
        alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT' || alvo.isContentEditable);
      if (digitando || e.ctrlKey || e.altKey || e.metaKey) return;

      const indiceAba = '123456'.indexOf(e.key);
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
      <AlertaOverlay />
      <MidiaPlayerGM />
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
          <h1
            onClick={abrirControle}
            title="abrir controle — janela secreta do mestre"
            style={{ fontSize: '18px', margin: 0, cursor: 'pointer' }}
          >
            Estática — Mesa
          </h1>
          <nav style={{ display: 'flex', gap: '0.4rem' }}>
            {ABAS.map((a) => {
              const atalho = ATALHOS[a.id];
              const ativa = aba === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => setAba(a.id)}
                  title={`${a.label} (atalho: ${atalho})`}
                  style={
                    ativa
                      ? { borderColor: 'var(--rede)', color: 'var(--rede)', boxShadow: '0 0 0 1px var(--rede-glow)' }
                      : undefined
                  }
                >
                  {atalho} {a.label}
                </button>
              );
            })}
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <VinculoMestre />
          <ExportarImportar abrirControle={abrirControle} />
        </div>
      </header>
      <DestaqueSuperior />
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
          <SessaoTab />
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            visibility: aba === 'personagens' ? 'visible' : 'hidden',
            pointerEvents: aba === 'personagens' ? 'auto' : 'none',
            padding: '1.5rem',
            height: '100%',
          }}
        >
          <FichasTab />
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
          <DadosTab active={aba === 'dados'} />
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
          <MapaTab active={aba === 'mapa'} />
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
          <NpcsTab />
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
          <LogTab />
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
          <MidiaTab />
        </div>
      </main>
      <QuickRollOverlay
        abaAtual={aba}
        aberto={overlayAberto}
        onAbertoChange={setOverlayAberto}
        pedidoRolagem={pedidosRolagemRapida}
      />
    </div>
  );
}
