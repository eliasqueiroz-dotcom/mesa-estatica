import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useStore } from '../state/store';

interface Props {
  children: ReactNode;
}

interface State {
  erro: Error | null;
}

/**
 * Contém erro de RENDER — antes disto, `mestre.tsx`/`jogador.tsx` montavam só `<StrictMode>`
 * puro, então qualquer exceção num componente (um campo `undefined` inesperado vindo de um
 * JSON importado, uma sync remota com shape estranho) derrubava a tela inteira, no meio de
 * uma sessão ao vivo, sem chance de recuperação — pro mestre e pra qualquer jogador.
 *
 * O crash é só de render — o estado persistido (localStorage) não é afetado — então o
 * fallback oferece baixar um backup do que já está salvo antes de recarregar, chamando
 * `exportarJSON` direto do store (`useStore.getState()`, imperativo — não depende de nenhum
 * componente que possa estar quebrado).
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { erro: null };

  static getDerivedStateFromError(erro: Error): State {
    return { erro };
  }

  componentDidCatch(erro: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] erro de render não capturado', erro, info.componentStack);
  }

  baixarBackup = (): void => {
    try {
      const json = useStore.getState().exportarJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `estatica-mesa-emergencia-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.alert('não deu nem pra exportar por aqui — os dados ainda devem estar no localStorage deste navegador; não recarregue antes de tentar outra forma de salvar.');
    }
  };

  recarregar = (): void => window.location.reload();

  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: '1rem',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '20px', margin: 0 }}>a tela travou — mas os dados ainda estão salvos</h1>
        <p className="vazio" style={{ maxWidth: 480 }}>
          algo quebrou na renderização. o estado da mesa não some por isso — continua no localStorage deste
          navegador. baixe um backup por garantia antes de recarregar.
        </p>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button className="acento" onClick={this.baixarBackup}>
            baixar backup agora
          </button>
          <button onClick={this.recarregar}>recarregar</button>
        </div>
        <details style={{ marginTop: '1rem', fontSize: '11px', color: 'var(--ink-dim)' }}>
          <summary style={{ cursor: 'pointer' }}>detalhe técnico</summary>
          <pre className="mono" style={{ whiteSpace: 'pre-wrap', textAlign: 'left', maxWidth: 480 }}>
            {this.state.erro.message}
          </pre>
        </details>
      </div>
    );
  }
}
