import { useRef, useState } from 'react';
import DadosTab from '../features/dados/DadosTab';
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

  const abrirControle = () => {
    window.open(
      `${location.origin}${location.pathname}#controle`,
      'estatica-controle',
      'width=620,height=760',
    );
  };

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
      <main style={{ flex: 1, overflow: 'hidden' }}>
        {aba === 'sessao' && <Placeholder nome="Sessão" />}
        {aba === 'personagens' && (
          <div style={{ padding: '1.5rem', height: '100%' }}>
            <FichasTab />
          </div>
        )}
        {aba === 'dados' && (
          <div style={{ padding: '1.5rem', height: '100%', overflowY: 'auto' }}>
            <DadosTab />
          </div>
        )}
        {aba === 'mapa' && <Placeholder nome="Mapa" />}
        {aba === 'npcs' && <Placeholder nome="NPCs & Iniciativa" />}
        {aba === 'log' && <LogTab />}
      </main>
    </div>
  );
}
