import { useState } from 'react';
import { rolarDadosComForcados } from '../../../dice/registroForcados';
import { calcularPvMaximo, estaFerido } from '../../../rules/derivados';
import { ATRIBUTOS, PERICIAS, type DefinicaoPericia, type GrauPericia } from '../../../rules/data/pericias';
import { useStore } from '../../../state/store';
import type { SecaoFichaProps } from '../tipos';

const GRAUS: { valor: GrauPericia; label: string }[] = [
  { valor: 0, label: '—' },
  { valor: 3, label: 'T' },
  { valor: 6, label: 'V' },
];

/** Cada linha tem um botão de rolagem direta (d20 + atributo + grau, com Ferido aplicado) —
 *  ficha.md já documentava isso, nunca tinha sido implementado. De propósito, sem sucesso/falha
 *  contra a DT da cena — só o total, igual RoladorTesteJogador.tsx; o mestre narra o resultado. */
export default function PericiasSection({ ficha, onChange }: SecaoFichaProps) {
  const basePV = useStore((s) => s.config.basePV);
  const registrarLog = useStore((s) => s.registrarLog);
  const registrarRoll = useStore((s) => s.registrarRoll);
  const [resultados, setResultados] = useState<Record<string, string>>({});

  const definirGrau = (periciaId: string, grau: GrauPericia) => {
    onChange({ pericias: { ...ficha.pericias, [periciaId]: grau } });
  };

  const rolarPericia = (p: DefinicaoPericia) => {
    const grauPericia = ficha.pericias[p.id] ?? 0;
    const pvMaximo = calcularPvMaximo(basePV, ficha.atributos.vigor);
    const ferido = estaFerido(ficha.pvAtual, pvMaximo);
    const [d20] = rolarDadosComForcados(1, 20, ficha.id, 'teste');
    const nome = ficha.nome || 'Personagem';
    const atributoNome = ATRIBUTOS.find((a) => a.id === p.atributo)!.nome;

    const penalidadeFerido = ferido && (p.atributo === 'vigor' || p.atributo === 'agilidade') ? -2 : 0;
    const modificador = ficha.atributos[p.atributo] + grauPericia + penalidadeFerido;
    const total = d20 + modificador;
    const modStr = modificador >= 0 ? `+${modificador}` : `${modificador}`;
    registrarLog('teste', `${nome} · teste de perícia ${p.nome}(${atributoNome}) → 1d20: ${d20}${modStr} = ${total}`, ficha.id, 'publica');
    registrarRoll({ origem: nome, personagemId: ficha.id, formula: `d20${modStr}`, total, bruto: d20, visibilidade: 'publica' });
    setResultados((prev) => ({ ...prev, [p.id]: `d20=${d20}${modStr}=${total}` }));
  };

  return (
    <section className="secao">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h3 className="label" style={{ margin: 0 }}>Perícias</h3>
        <span className="vazio" style={{ fontSize: 10 }}>— · T=treinado · V=veterano</span>
      </div>
      <div className="pericias-grid">
        {ATRIBUTOS.map((atributo) => {
          const daColuna = PERICIAS.filter((p) => p.atributo === atributo.id);
          if (daColuna.length === 0) return null;
          return (
            <div key={atributo.id} className="pericias-coluna">
              <h4>{atributo.nome}</h4>
              {daColuna.map((p) => {
                const grauAtual = ficha.pericias[p.id] ?? 0;
                return (
                  <div key={p.id} className="pericia-linha">
                    <span className="pericia-linha__nome">{p.nome}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button className="icone-botao" title={`rolar ${atributo.nome}+${p.nome}`} onClick={() => rolarPericia(p)}>
                        d20
                      </button>
                      <div className="grau-toggle">
                        {GRAUS.map((g) => (
                          <button
                            key={g.valor}
                            data-ativo={grauAtual === g.valor}
                            onClick={() => definirGrau(p.id, g.valor)}
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {resultados[p.id] && (
                      <div className="mono vazio" style={{ fontSize: 10, width: '100%' }}>
                        {resultados[p.id]}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
