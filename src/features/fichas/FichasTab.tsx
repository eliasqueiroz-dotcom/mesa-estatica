import { useStore } from '../../state/store';
import FichaEditor from './FichaEditor';
import './ficha.css';

export default function FichasTab() {
  const fichas = useStore((s) => s.fichas);
  const fichaAtivaId = useStore((s) => s.fichaAtivaId);
  const adicionarFicha = useStore((s) => s.adicionarFicha);
  const removerFicha = useStore((s) => s.removerFicha);
  const definirFichaAtiva = useStore((s) => s.definirFichaAtiva);

  const fichaAtiva = fichas.find((f) => f.id === fichaAtivaId) ?? fichas[0] ?? null;

  const remover = (id: string, nome: string) => {
    const ok = window.confirm(`Apagar a ficha "${nome || 'sem nome'}"? Isso não pode ser desfeito.`);
    if (ok) removerFicha(id);
  };

  return (
    <div className="fichas-tab">
      <div className="fichas-lista">
        <button className="acento" onClick={() => adicionarFicha()}>
          + novo personagem
        </button>
        {fichas.map((f) => (
          <button
            key={f.id}
            className="fichas-lista__item"
            data-ativa={f.id === fichaAtiva?.id}
            onClick={() => definirFichaAtiva(f.id)}
          >
            <span className="fichas-lista__cor" style={{ background: f.corVisual }} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {f.nome || 'sem nome'}
            </span>
            <span
              className="icone-botao"
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                remover(f.id, f.nome);
              }}
              style={{ color: 'var(--ruido)' }}
            >
              ×
            </span>
          </button>
        ))}
      </div>
      {fichaAtiva ? (
        <FichaEditor ficha={fichaAtiva} />
      ) : (
        <p className="vazio">nenhum personagem ainda — clique em "+ novo personagem".</p>
      )}
    </div>
  );
}
