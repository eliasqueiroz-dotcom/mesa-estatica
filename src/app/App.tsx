import { useEffect, useRef, useState } from 'react';
import DadosTab from '../features/dados/DadosTab';
import QuickRollOverlay from '../features/dados/QuickRollOverlay';
import FichasTab from '../features/fichas/FichasTab';
import { useStore } from '../state/store';
import LogTab from './LogTab';

type AbaId = 'sessao' | 'personagens' | 'dados' | 'mapa' | 'npcs' | 'log';

const ABAS: { id: AbaId; label: string }[] = [
  { id: 'sessao', label: 'Sessão' },
  { id: 'personagens', label: 'Personagens' },
  { id: 'dados', label: 'Dados & Regras' },
  { id: 'mapa', label: 'Mapa' },
  { id: 'npcs', label: 'NPCs & Iniciativa' },
  { id: 'log', label: 'Log' },
];

function Placeholder({ nome }: { nome: string }) {
  return (
    <div style={{ padding: '1.5rem' }}>
      <p className="vazio">{nome} — ainda não construído neste dia do roadmap.</p>
    </div>
  );
}

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
        window.alert('arquivo inválido — não foi possível importar.');
      }
    });
    e.target.value = '';
  };

  return (
    <div style={{ display: 'flex', gap: '0.4rem' }}>
      <button onClick={exportar}>imprimir tudo</button>
      <button onClick={() => inputRef.current?.click()}>importar</button>
      {/* botão de controle agora oculto; o controle é acessível clicando no título principal */}
      <button onClick={abrirControle} title="janela secreta do mestre — não compartilhar" style={{ display: 'none' }}>
        controle
      </button>
      <input ref={inputRef} type="file" accept="application/json" hidden onChange={importar} />
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
        setOverlayAberto(true);
        setPedidosRolagemRapida((n) => n + 1);
      } else if (tecla === 's') {
        setOverlayAberto(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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
          <h1
            onClick={abrirControle}
            title="abrir controle — janela secreta do mestre"
            style={{ fontSize: '18px', margin: 0, cursor: 'pointer' }}
          >
            Estática — Mesa
          </h1>
          <nav style={{ display: 'flex', gap: '0.3rem' }}>
            {ABAS.map((a, i) => (
              <button
                key={a.id}
                onClick={() => setAba(a.id)}
                style={
                  aba === a.id
                    ? { borderColor: 'var(--rede)', color: 'var(--rede)', boxShadow: '0 0 0 1px var(--rede-glow)' }
                    : undefined
                }
              >
                {i + 1} {a.label}
              </button>
            ))}
          </nav>
        </div>
        <ExportarImportar abrirControle={abrirControle} />
      </header>
      <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            visibility: aba === 'sessao' ? 'visible' : 'hidden',
            pointerEvents: aba === 'sessao' ? 'auto' : 'none',
            height: '100%',
          }}
        >
          <Placeholder nome="Sessão" />
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
          <Placeholder nome="Mapa" />
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            visibility: aba === 'npcs' ? 'visible' : 'hidden',
            pointerEvents: aba === 'npcs' ? 'auto' : 'none',
            height: '100%',
          }}
        >
          <Placeholder nome="NPCs & Iniciativa" />
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            visibility: aba === 'log' ? 'visible' : 'hidden',
            pointerEvents: aba === 'log' ? 'auto' : 'none',
            height: '100%',
          }}
        >
          <LogTab />
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
