import { useState } from 'react';
import { useStore } from '../../state/store';

// arredonda pro campo numérico ficar digitável (arrastar produz float; digitar quer inteiro).
const clamp = (valor: number, min: number, max: number) => Math.round(Math.max(min, Math.min(max, valor)));

/**
 * Controle do grid do mapa, minimizado — mesmo padrão visual da bandeja de rolagem rápida
 * (QuickRollOverlay), no canto oposto (inferior esquerdo). Fica só na aba Mapa: dentro de
 * MapaTab, que já vira `visibility:hidden` nas outras abas (App.tsx) — isso também esconde
 * este `position:fixed`, apesar de fixed normalmente escapar do layout do ancestral.
 */
export default function GradeOverlay() {
  const grade = useStore((s) => s.mapa.grade);
  const atualizarGrade = useStore((s) => s.atualizarGrade);
  const [aberto, setAberto] = useState(false);

  return (
    <div style={{ position: 'fixed', left: '1.25rem', bottom: '1.25rem', zIndex: 50 }}>
      {aberto && (
        <div className="secao" style={{ width: 260, marginBottom: '0.6rem', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h3 className="label" style={{ margin: 0 }}>
              grid do mapa
            </h3>
            <button className="icone-botao" onClick={() => setAberto(false)} title="fechar">
              ×
            </button>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
            <input type="checkbox" checked={grade.ativa} onChange={(e) => atualizarGrade({ ativa: e.target.checked })} />
            <span style={{ fontSize: 13 }}>ativo</span>
          </label>

          {grade.ativa && (
            <div className="campos-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label htmlFor="grade-colunas">colunas</label>
                <input
                  id="grade-colunas"
                  type="number"
                  min={1}
                  max={100}
                  value={grade.colunas}
                  onChange={(e) => atualizarGrade({ colunas: clamp(Number(e.target.value) || 1, 1, 100) })}
                />
              </div>
              <div>
                <label htmlFor="grade-linhas">linhas</label>
                <input
                  id="grade-linhas"
                  type="number"
                  min={1}
                  max={100}
                  value={grade.linhas}
                  onChange={(e) => atualizarGrade({ linhas: clamp(Number(e.target.value) || 1, 1, 100) })}
                />
              </div>
              <div>
                <label htmlFor="grade-x">x (%)</label>
                <input
                  id="grade-x"
                  type="number"
                  min={0}
                  max={100}
                  value={grade.x}
                  onChange={(e) => atualizarGrade({ x: clamp(Number(e.target.value) || 0, 0, 100) })}
                />
              </div>
              <div>
                <label htmlFor="grade-y">y (%)</label>
                <input
                  id="grade-y"
                  type="number"
                  min={0}
                  max={100}
                  value={grade.y}
                  onChange={(e) => atualizarGrade({ y: clamp(Number(e.target.value) || 0, 0, 100) })}
                />
              </div>
              <div>
                <label htmlFor="grade-largura">largura (%)</label>
                <input
                  id="grade-largura"
                  type="number"
                  min={0}
                  max={100}
                  value={grade.largura}
                  onChange={(e) => atualizarGrade({ largura: clamp(Number(e.target.value) || 0, 0, 100) })}
                />
              </div>
              <div>
                <label htmlFor="grade-altura">altura (%)</label>
                <input
                  id="grade-altura"
                  type="number"
                  min={0}
                  max={100}
                  value={grade.altura}
                  onChange={(e) => atualizarGrade({ altura: clamp(Number(e.target.value) || 0, 0, 100) })}
                />
              </div>
              <div>
                <label htmlFor="grade-escala">escala (por célula)</label>
                <input
                  id="grade-escala"
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={grade.escala}
                  onChange={(e) => atualizarGrade({ escala: Math.max(0.1, Number(e.target.value) || 0.1) })}
                />
              </div>
              <div>
                <label htmlFor="grade-unidade">unidade</label>
                <select
                  id="grade-unidade"
                  value={grade.unidade}
                  onChange={(e) => atualizarGrade({ unidade: e.target.value as 'm' | 'km' })}
                >
                  <option value="m">metros (m)</option>
                  <option value="km">quilômetros (km)</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}
      <button
        onClick={() => setAberto(!aberto)}
        title="grid do mapa"
        style={
          grade.ativa
            ? { borderRadius: '50%', width: 48, height: 48, padding: 0, borderColor: 'var(--rede-dim)', color: 'var(--rede)' }
            : { borderRadius: '50%', width: 48, height: 48, padding: 0 }
        }
      >
        #
      </button>
    </div>
  );
}
