import { useEffect, useState } from 'react';
import type { ColorsetId } from '../../dice/colorsets';
import type { RollGroupResult } from '../../dice/useDiceBox';
import { calcularPvMaximo, estaFerido } from '../../rules/derivados';
import { ATRIBUTOS, PERICIAS } from '../../rules/data/pericias';
import { descricaoResultado, resolverTeste } from '../../rules/teste';
import { useStore } from '../../state/store';
import { useDtDaCena } from './useDtDaCena';

interface RoladorTesteProps {
  ready: boolean;
  rolar: (
    notacao: string,
    onComplete: (r: RollGroupResult[]) => void,
    colorset?: ColorsetId,
    personagemId?: string | null,
  ) => void;
}

type ModoRolagem = 'pc' | 'npc' | 'nenhum';

export default function RoladorTeste({ ready, rolar }: RoladorTesteProps) {
  const fichas = useStore((s) => s.fichas);
  const npcs = useStore((s) => s.npcs);
  const basePV = useStore((s) => s.config.basePV);
  const registrarLog = useStore((s) => s.registrarLog);
  const registrarRoll = useStore((s) => s.registrarRoll);

  const [modo, setModo] = useState<ModoRolagem>('pc');
  const [fichaId, setFichaId] = useState('');
  const [npcId, setNpcId] = useState('');
  const [periciaId, setPericiaId] = useState(PERICIAS[0].id);
  const [bonus, setBonus] = useState(0);
  const [privado, setPrivado] = useState(false);
  const [resultadoRolagem, setResultadoRolagem] = useState<{ sucesso: boolean; d20: number; modificador: number; total: number; descricao?: string } | null>(null);
  const [rolando, setRolando] = useState(false);

  const ficha = fichas.find((f) => f.id === fichaId) ?? null;
  const npc = npcs.find((n) => n.id === npcId) ?? null;
  const pericia = PERICIAS.find((p) => p.id === periciaId)!;
  const atributo = ATRIBUTOS.find((a) => a.id === pericia.atributo)!;
  const dt = useDtDaCena();

  useEffect(() => {
    setPrivado(modo === 'npc');
    setResultadoRolagem(null);
  }, [modo]);

  const podeRolar = ready && !rolando && ((modo === 'pc' && ficha) || (modo === 'npc' && npc));
  const visibilidade = privado ? 'privada' as const : 'publica' as const;

  const rolarTeste = () => {
    if (modo === 'nenhum') return;

    setRolando(true);

    if (modo === 'pc' && ficha) {
      rolar('1d20', (grupos) => {
        const d20 = grupos[0]?.rolls[0]?.value ?? 0;
        const pvMaximo = calcularPvMaximo(basePV, ficha.atributos.vigor);
        const ferido = estaFerido(ficha.pvAtual, pvMaximo);
        const grauPericia = ficha.pericias[periciaId] ?? 0;
        const r = resolverTeste({
          d20,
          atributoId: pericia.atributo,
          valorAtributo: ficha.atributos[pericia.atributo],
          grauPericia,
          personagemFerido: ferido,
          dt,
        });
        setResultadoRolagem({ sucesso: r.sucesso, d20: r.d20, modificador: r.modificador, total: r.total, descricao: descricaoResultado(r) });
        setRolando(false);

        const origem = ficha.nome || 'Personagem';
        const formula = `d20${r.modificador >= 0 ? '+' : ''}${r.modificador}`;
        registrarLog(
          'teste',
          `${origem} · ${atributo.nome}+${pericia.nome} → ${d20}${r.modificador >= 0 ? '+' : ''}${r.modificador} = ${r.total} · ${descricaoResultado(r)}`,
          ficha.id,
          visibilidade,
        );
        registrarRoll({
          origem,
          personagemId: ficha.id,
          formula,
          total: r.total,
          bruto: d20,
          visibilidade,
        });
      }, 'rede', ficha.id);
    } else if (modo === 'npc' && npc) {
      rolar('1d20', (grupos) => {
        const d20 = grupos[0]?.rolls[0]?.value ?? 0;
        const total = d20 + bonus;
        setResultadoRolagem({ sucesso: true, d20, modificador: bonus, total });
        setRolando(false);

        const origem = npc.nome || 'NPC';
        const formula = bonus !== 0 ? `d20+${bonus}` : 'd20';
        registrarLog(
          'teste',
          `${origem} · teste → ${d20}${bonus >= 0 ? '+' : ''}${bonus} = ${total}`,
          npc.id,
          visibilidade,
        );
        registrarRoll({
          origem,
          personagemId: npc.id,
          formula,
          total,
          bruto: d20,
          visibilidade,
        });
      }, undefined, npc.id);
    }
  };

  return (
    <section className="secao">
      <h3 className="label">Rolador de teste</h3>

      <div className="campos-grid">
        <div>
          <label htmlFor="rt-modo">Quem está rolando</label>
          <select
            id="rt-modo"
            value={modo}
            onChange={(e) => setModo(e.target.value as ModoRolagem)}
          >
            <option value="nenhum">— selecione —</option>
            <option value="pc">PC</option>
            <option value="npc">NPC</option>
          </select>
        </div>
      </div>

      {modo === 'nenhum' && (
        <p className="vazio" style={{ marginTop: '0.75rem' }}>
          selecione quem vai rolar acima.
        </p>
      )}

      {modo === 'pc' && (
        <div className="campos-grid" style={{ gridTemplateColumns: '1fr' }}>
          <div>
            <label htmlFor="rt-ficha">Personagem</label>
            <select id="rt-ficha" value={fichaId} onChange={(e) => setFichaId(e.target.value)}>
              <option value="">— selecione —</option>
              {fichas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome || 'sem nome'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rt-pericia">Perícia</label>
            <select id="rt-pericia" value={periciaId} onChange={(e) => setPericiaId(e.target.value)}>
              {PERICIAS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} ({ATRIBUTOS.find((a) => a.id === p.atributo)!.nome})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {modo === 'npc' && (
        <div className="campos-grid" style={{ gridTemplateColumns: '1fr' }}>
          <div>
            <label htmlFor="rt-npc">NPC</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <select id="rt-npc" value={npcId} onChange={(e) => setNpcId(e.target.value)} style={{ flex: 1 }}>
                <option value="">— selecione —</option>
                {npcs.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.nome || 'sem nome'}
                  </option>
                ))}
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={privado} onChange={(e) => setPrivado(e.target.checked)} />
                privado
              </label>
            </div>
          </div>
          <div>
            <label htmlFor="rt-bonus">Bônus total</label>
            <input
              id="rt-bonus"
              type="number"
              value={bonus}
              onChange={(e) => setBonus(Number(e.target.value) || 0)}
            />
          </div>
          {npc && npc.acoes && npc.acoes.length > 0 && (
            <div style={{ marginTop: '0.25rem' }}>
              <label>Ações</label>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                {npc.acoes.map((a) => (
                  <button
                    key={a.id}
                    className="pill"
                    onClick={() => setBonus(a.bonus)}
                    style={{
                      background: bonus === a.bonus ? 'var(--concrete-2)' : 'var(--concrete-1)',
                    }}
                  >
                    {a.nome} ({a.bonus >= 0 ? '+' : ''}{a.bonus})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
        <button className="acento" disabled={!podeRolar} onClick={rolarTeste}>
          rolar d20
        </button>
      </div>

      {resultadoRolagem && (
        <div
          className="alerta-banner mono"
          style={{
            marginTop: '0.75rem',
            borderColor: resultadoRolagem.sucesso ? 'var(--rede)' : 'var(--ruido)',
            color: resultadoRolagem.sucesso ? 'var(--rede)' : 'var(--ruido)',
          }}
        >
          <span>
            d20={resultadoRolagem.d20} {resultadoRolagem.modificador >= 0 ? '+' : ''}
            {resultadoRolagem.modificador} = {resultadoRolagem.total}
            {resultadoRolagem.descricao ? ` — ${resultadoRolagem.descricao}` : ''}
          </span>
        </div>
      )}
    </section>
  );
}
