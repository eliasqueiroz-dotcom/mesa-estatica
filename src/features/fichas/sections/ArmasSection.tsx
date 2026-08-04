import { useState } from 'react';
import { ARMAS, PROTECOES } from '../../../rules/data/armas';
import type { ArmaFicha } from '../../../state/types';
import type { SecaoFichaProps } from '../tipos';

export default function ArmasSection({ ficha, onChange }: SecaoFichaProps) {
  const [arsenalSelect, setArsenalSelect] = useState('');
  const [protecaoSelect, setProtecaoSelect] = useState('');
  const atualizar = (id: string, patch: Partial<ArmaFicha>) => {
    onChange({ armas: ficha.armas.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  };

  const remover = (id: string) => {
    onChange({ armas: ficha.armas.filter((a) => a.id !== id) });
  };

  const adicionarVazia = () => {
    const nova: ArmaFicha = { id: crypto.randomUUID(), nome: '', bonusAtaque: '', dano: '', alcance: '', nota: '' };
    onChange({ armas: [...ficha.armas, nova] });
  };

  const adicionarDoArsenal = (nomeArma: string) => {
    const def = ARMAS.find((a) => a.nome === nomeArma);
    if (!def) return;
    const nova: ArmaFicha = {
      id: crypto.randomUUID(),
      nome: def.nome,
      bonusAtaque: def.somaVigor ? 'Vigor + Briga' : 'Agilidade + Pontaria',
      dano: def.somaVigor ? `${def.dano} + Vigor` : def.dano,
      alcance: `${def.alcanceMetros} m`,
      nota: def.nota,
    };
    onChange({ armas: [...ficha.armas, nova] });
  };

  const aplicarProtecao = (nomeProtecao: string) => {
    const def = PROTECOES.find((p) => p.nome === nomeProtecao);
    if (!def) return;
    onChange({ equipamentoModificadorDefesa: def.defesa });
  };

  return (
    <section className="secao">
      <h3 className="label">Armas e Proteção</h3>
      {ficha.armas.length > 0 && (
        <table className="armas-tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Ataque (d20 + …)</th>
              <th>Dano</th>
              <th>Alcance</th>
              <th>Nota</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {ficha.armas.map((a) => (
              <tr key={a.id}>
                <td>
                  <input value={a.nome} onChange={(e) => atualizar(a.id, { nome: e.target.value })} />
                </td>
                <td>
                  <input value={a.bonusAtaque} onChange={(e) => atualizar(a.id, { bonusAtaque: e.target.value })} />
                </td>
                <td>
                  <input value={a.dano} onChange={(e) => atualizar(a.id, { dano: e.target.value })} />
                </td>
                <td>
                  <input value={a.alcance} onChange={(e) => atualizar(a.id, { alcance: e.target.value })} />
                </td>
                <td>
                  <input value={a.nota} onChange={(e) => atualizar(a.id, { nota: e.target.value })} />
                </td>
                <td>
                  <button className="icone-botao perigo" onClick={() => remover(a.id)}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="acento" onClick={adicionarVazia}>
          + arma livre
        </button>
        <select
          value={arsenalSelect}
          onChange={(e) => {
            const val = e.target.value;
            setArsenalSelect('');
            if (val) adicionarDoArsenal(val);
          }}
        >
          <option value="">+ do arsenal…</option>
          {ARMAS.map((a) => (
            <option key={a.nome} value={a.nome}>
              {a.nome}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: '1rem', display: 'grid', gap: '0.6rem' }}>
        <h4 className="label" style={{ margin: 0 }}>
          Proteção
        </h4>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={protecaoSelect}
            onChange={(e) => {
              const val = e.target.value;
              setProtecaoSelect('');
              if (val) aplicarProtecao(val);
            }}
          >
            <option value="">+ proteção…</option>
            {PROTECOES.map((p) => (
              <option key={p.nome} value={p.nome}>
                {p.nome} — {p.preco}
              </option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', margin: 0 }}>
            <span className="vazio">bônus de defesa</span>
            <input
              type="number"
              value={ficha.equipamentoModificadorDefesa}
              onChange={(e) => onChange({ equipamentoModificadorDefesa: Number(e.target.value) || 0 })}
              style={{ width: 72 }}
            />
          </label>
        </div>
        <p className="vazio">A proteção escolhida soma no cálculo de Defesa da ficha.</p>
      </div>
    </section>
  );
}
