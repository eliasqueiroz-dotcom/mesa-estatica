import { TABELA_TRAUMAS } from '../../../rules/data/traumas';
import type { TraumaFicha } from '../../../state/types';
import type { SecaoFichaProps } from '../tipos';

const MAX_TRAUMAS = 3;

export default function TraumasSection({ ficha, onChange }: SecaoFichaProps) {
  const atualizar = (id: string, patch: Partial<TraumaFicha>) => {
    onChange({ traumas: ficha.traumas.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  };

  const remover = (id: string) => {
    onChange({ traumas: ficha.traumas.filter((t) => t.id !== id) });
  };

  const adicionar = (sorteado?: (typeof TABELA_TRAUMAS)[number]) => {
    if (ficha.traumas.length >= MAX_TRAUMAS) return;
    const novo: TraumaFicha = {
      id: crypto.randomUUID(),
      nome: sorteado?.nome ?? '',
      gatilho: sorteado?.gatilho ?? '',
      resposta: sorteado?.resposta ?? '',
      virouCicatriz: false,
      cicatrizUsadaNestaSessao: false,
    };
    onChange({ traumas: [...ficha.traumas, novo] });
  };

  const sortear = () => {
    // Math.random() puro, deliberado: este sorteio não é uma rolagem física na bandeja de dados,
    // então não deve consumir a fila de valores forçados de forcarRolagem.ts — essa fila é
    // exclusiva de rolagens reais que o mestre vê na tela (ver useDiceBox.montarNotacao).
    // Conectar os dois já causou um bug real: um valor forçado pra um teste na aba Dados sumia
    // silenciosamente se alguém sorteasse um trauma antes de rolar.
    const d20 = Math.floor(Math.random() * 20) + 1;
    const entrada = TABELA_TRAUMAS.find((t) => t.d20 === d20)!;
    adicionar(entrada);
  };

  return (
    <section className="secao">
      <h3 className="label">
        Traumas e Cicatrizes ({ficha.traumas.length}/{MAX_TRAUMAS})
      </h3>
      {ficha.traumas.length === 0 && <p className="vazio">nenhum trauma ainda.</p>}
      {ficha.traumas.map((t) => (
        <div key={t.id} className="trauma-card">
          <div className="trauma-card__topo">
            <input
              placeholder="nome do trauma"
              value={t.nome}
              onChange={(e) => atualizar(t.id, { nome: e.target.value })}
              style={{ flex: 1 }}
            />
            <label className="cicatriz-toggle">
              <input
                type="checkbox"
                checked={t.virouCicatriz}
                onChange={(e) => atualizar(t.id, { virouCicatriz: e.target.checked })}
              />
              virou cicatriz
            </label>
            <button className="icone-botao perigo" onClick={() => remover(t.id)}>
              remover
            </button>
          </div>
          <div className="campos-grid">
            <input
              placeholder="gatilho (detalhe específico)"
              value={t.gatilho}
              onChange={(e) => atualizar(t.id, { gatilho: e.target.value })}
            />
            <input
              placeholder="resposta"
              value={t.resposta}
              onChange={(e) => atualizar(t.id, { resposta: e.target.value })}
            />
          </div>
          {t.virouCicatriz && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem', fontSize: '12px' }}>
              <input
                type="checkbox"
                checked={t.cicatrizUsadaNestaSessao}
                onChange={(e) => atualizar(t.id, { cicatrizUsadaNestaSessao: e.target.checked })}
              />
              +2 já usado nesta sessão
            </label>
          )}
        </div>
      ))}
      {ficha.traumas.length < MAX_TRAUMAS && (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="acento" onClick={() => adicionar()}>
            + trauma manual
          </button>
          <button className="acento" onClick={sortear}>
            sortear na tabela (d20)
          </button>
        </div>
      )}
    </section>
  );
}
