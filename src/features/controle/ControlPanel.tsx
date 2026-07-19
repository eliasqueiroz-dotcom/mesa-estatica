import { useEffect, useState } from 'react';
import { assinar, enviarForcados, estadoAtual, limparForcados, pedirEstado, type EstadoForca } from '../../dice/forcarRolagem';
import '../../styles/tokens.css';
import '../../styles/base.css';

/**
 * Janela de controle secreta do mestre. Abrir em janela separada (fora da que é
 * compartilhada no Discord). Fala com a janela principal via BroadcastChannel.
 * Força o VALOR BRUTO do(s) dado(s) — a ficha soma os modificadores depois.
 */
export default function ControlPanel() {
  const [estado, setEstado] = useState<EstadoForca>(estadoAtual());
  const [valorUnico, setValorUnico] = useState(20);
  const [lista, setLista] = useState('');
  const [persistir, setPersistir] = useState(false);

  useEffect(() => {
    const desassinar = assinar(setEstado);
    pedirEstado();
    return desassinar;
  }, []);

  const forcarUnico = () => enviarForcados([valorUnico], !persistir);

  const forcarLista = () => {
    const valores = lista
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n));
    if (valores.length > 0) enviarForcados(valores, !persistir);
  };

  const forcado = estado.valores !== null;

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '1.5rem', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 20, marginBottom: '0.25rem' }}>Controle — rolagem forçada</h1>
      <p className="vazio" style={{ marginBottom: '1.25rem' }}>
        janela secreta do mestre. mantenha fora da tela compartilhada no discord. o padrão é honesto.
      </p>

      <div
        className="alerta-banner mono"
        style={{
          marginBottom: '1.25rem',
          borderColor: forcado ? 'var(--ruido)' : 'var(--rede-dim)',
          color: forcado ? 'var(--ruido)' : 'var(--ink-dim)',
        }}
      >
        <span>
          {forcado
            ? `próxima rolagem FORÇADA: [${estado.valores!.join(', ')}]${estado.umaVez ? ' (uma vez)' : ' (até cancelar)'}`
            : 'próxima rolagem: honesta'}
        </span>
        {forcado && (
          <button className="icone-botao" onClick={limparForcados}>
            cancelar
          </button>
        )}
      </div>

      <section className="secao" style={{ marginBottom: '1rem' }}>
        <h3 className="label">Forçar um dado (o caso comum)</h3>
        <p className="vazio" style={{ marginBottom: '0.6rem' }}>
          valor bruto do dado — ex: para um teste, o d20. a ficha soma atributo + perícia depois.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="number"
            min={1}
            max={100}
            value={valorUnico}
            onChange={(e) => setValorUnico(Math.max(1, Number(e.target.value) || 1))}
            style={{ width: 90 }}
          />
          <button className="acento" onClick={forcarUnico}>
            forçar próxima rolagem
          </button>
        </div>
      </section>

      <section className="secao" style={{ marginBottom: '1rem' }}>
        <h3 className="label">Forçar vários dados</h3>
        <p className="vazio" style={{ marginBottom: '0.6rem' }}>
          um valor por dado, na ordem da rolagem, separados por vírgula. ex: surto (2d20) → "10,12";
          sanidade (Vontade + perda) → "d20, dado da perda".
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input placeholder="ex: 10, 12" value={lista} onChange={(e) => setLista(e.target.value)} />
          <button className="acento" onClick={forcarLista} disabled={lista.trim() === ''}>
            forçar
          </button>
        </div>
      </section>

      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 13 }}>
        <input type="checkbox" checked={persistir} onChange={(e) => setPersistir(e.target.checked)} />
        manter forçado até eu cancelar (senão, vale só para a próxima rolagem)
      </label>
    </div>
  );
}
