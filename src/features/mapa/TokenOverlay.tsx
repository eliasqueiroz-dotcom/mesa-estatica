import { useEffect } from 'react';
import { calcularPvMaximo, calcularSanidadeMaxima } from '../../rules/derivados';
import { useStore } from '../../state/store';

interface Props {
  tipo: 'pc' | 'npc';
  id: string;
  onFechar: () => void;
}

interface StepperProps {
  label: string;
  atual: number;
  maximo: number;
  onAjustar: (delta: number) => void;
}

function StepperLinha({ label, atual, maximo, onAjustar }: StepperProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
      <span className="vazio">{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <button className="icone-botao" onClick={() => onAjustar(-1)}>
          −
        </button>
        <span className="mono">
          {atual} / {maximo}
        </span>
        <button className="icone-botao" onClick={() => onAjustar(1)}>
          +
        </button>
      </div>
    </div>
  );
}

/** Overlay de detalhes/ajuste rápido — abre ao CLICAR num token (não arrastar, ver MapaTab),
 *  fecha por X, clique fora, ou Esc. Escreve direto no Zustand — reflete na aba Personagens/NPCs
 *  e vice-versa (mesa-estatica-multiplayer-completo.md Parte II §1). */
export default function TokenOverlay({ tipo, id, onFechar }: Props) {
  const ficha = useStore((s) => (tipo === 'pc' ? s.fichas.find((f) => f.id === id) : undefined));
  const npc = useStore((s) => (tipo === 'npc' ? s.npcs.find((n) => n.id === id) : undefined));
  const basePV = useStore((s) => s.config.basePV);
  const ajustarPvAtual = useStore((s) => s.ajustarPvAtual);
  const ajustarSanidadeAtual = useStore((s) => s.ajustarSanidadeAtual);
  const ajustarDeterminacao = useStore((s) => s.ajustarDeterminacao);
  const atualizarNpc = useStore((s) => s.atualizarNpc);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onFechar]);

  if (tipo === 'pc' && !ficha) return null;
  if (tipo === 'npc' && !npc) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11, 13, 17, 0.6)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onFechar}
    >
      <div className="secao" style={{ width: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>{(tipo === 'pc' ? ficha!.nome : npc!.nome) || 'sem nome'}</h3>
          <button className="icone-botao" onClick={onFechar} title="fechar (Esc)">
            ×
          </button>
        </div>

        {tipo === 'pc' && ficha && (
          <>
            <StepperLinha
              label="PV"
              atual={ficha.pvAtual}
              maximo={calcularPvMaximo(basePV, ficha.atributos.vigor)}
              onAjustar={(d) => ajustarPvAtual(ficha.id, ficha.pvAtual + d)}
            />
            <StepperLinha
              label="Sanidade"
              atual={ficha.sanidadeAtual}
              maximo={calcularSanidadeMaxima(ficha.atributos.vontade)}
              onAjustar={(d) => ajustarSanidadeAtual(ficha.id, ficha.sanidadeAtual + d)}
            />
            <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span className="label" style={{ fontSize: '12px' }}>
                Determinação
              </span>
              {[1, 2].map((n) => (
                <label key={n} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={ficha.determinacao >= n}
                    onChange={() => ajustarDeterminacao(ficha.id, ficha.determinacao >= n ? n - 1 : n)}
                  />
                </label>
              ))}
            </div>
          </>
        )}

        {tipo === 'npc' && npc && (
          <>
            <div className="campos-grid">
              <div>
                <label htmlFor="ov-npc-pv">PV atual</label>
                <input
                  id="ov-npc-pv"
                  type="number"
                  value={npc.pvAtual}
                  onChange={(e) => atualizarNpc(npc.id, { pvAtual: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label htmlFor="ov-npc-pvmax">PV máximo</label>
                <input
                  id="ov-npc-pvmax"
                  type="number"
                  value={npc.pvMaximo}
                  onChange={(e) => atualizarNpc(npc.id, { pvMaximo: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label htmlFor="ov-npc-defesa">Defesa</label>
                <input
                  id="ov-npc-defesa"
                  type="number"
                  value={npc.defesa}
                  onChange={(e) => atualizarNpc(npc.id, { defesa: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label htmlFor="ov-npc-agi">Agilidade</label>
                <input
                  id="ov-npc-agi"
                  type="number"
                  value={npc.agilidade}
                  onChange={(e) => atualizarNpc(npc.id, { agilidade: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
            <textarea
              placeholder="notas — comportamento, gatilho, o que ele quer"
              value={npc.notas}
              onChange={(e) => atualizarNpc(npc.id, { notas: e.target.value })}
              style={{ marginTop: '0.4rem', minHeight: '3em' }}
            />
          </>
        )}
      </div>
    </div>
  );
}
