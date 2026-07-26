import { useState } from 'react';
import type { FichaPublica } from '../../multiplayer/fichaSplit';

interface Props {
  ficha: FichaPublica;
  onUpdate?: (patch: Partial<FichaPublica>) => void;
}

export default function FichaPublicaView({ ficha, onUpdate }: Props) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(ficha.observacaoCombate ?? '');

  const salvar = () => {
    onUpdate?.({ observacaoCombate: valor });
    setEditando(false);
  };

  const cancelar = () => {
    setValor(ficha.observacaoCombate ?? '');
    setEditando(false);
  };

  return (
    <section className="secao ficha-publica-view">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <span
          aria-hidden
          style={{ background: ficha.corVisual, width: 14, height: 14, borderRadius: '50%', display: 'inline-block', flexShrink: 0 }}
        />
        <h3 className="label" style={{ margin: 0 }}>
          {ficha.nome || 'sem nome'}
        </h3>
      </div>
      {editando ? (
        <div style={{ marginTop: '0.4rem' }}>
          <textarea
            rows={2}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="observações de combate…"
            style={{ width: '100%', minHeight: '2.5em', fontSize: 12 }}
          />
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
            <button className="acento" onClick={salvar} style={{ fontSize: 11, padding: '0.3em 0.6em' }}>
              salvar
            </button>
            <button onClick={cancelar} style={{ fontSize: 11, padding: '0.3em 0.6em' }}>
              cancelar
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{ marginTop: '0.4rem', cursor: onUpdate ? 'pointer' : undefined }}
          onClick={() => { if (onUpdate) setEditando(true); }}
        >
          {ficha.observacaoCombate ? (
            <p className="vazio" style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>
              {ficha.observacaoCombate}
            </p>
          ) : (
            onUpdate && <p className="vazio" style={{ margin: 0, fontSize: 11, fontStyle: 'italic' }}>+ adicionar observação de combate</p>
          )}
        </div>
      )}
    </section>
  );
}
