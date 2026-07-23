import { useEffect, useRef, useState } from 'react';
import { useDiceBox } from '../../dice/useDiceBox';
import { calcularPvMaximo, estaFerido } from '../../rules/derivados';
import { ATRIBUTOS, PERICIAS } from '../../rules/data/pericias';
import { descricaoResultado, resolverTeste } from '../../rules/teste';
import { useStore } from '../../state/store';
import { useDtDaCena } from './useDtDaCena';

interface QuickRollOverlayProps {
  abaAtual: string;
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  pedidoRolagem: number;
}

export default function QuickRollOverlay({ abaAtual, aberto, onAbertoChange, pedidoRolagem }: QuickRollOverlayProps) {
  const habilitado = abaAtual !== 'dados' && aberto;
  const { ready, rolando, modo2D, rolar } = useDiceBox('dice-overlay-rapido', habilitado, 45);
  const fichas = useStore((s) => s.fichas);
  const npcs = useStore((s) => s.npcs);
  const fichaAtivaId = useStore((s) => s.fichaAtivaId);
  const basePV = useStore((s) => s.config.basePV);
  const registrarLog = useStore((s) => s.registrarLog);
  const registrarRoll = useStore((s) => s.registrarRoll);

  const [modo, setModo] = useState<'simples' | 'pericia'>('simples');
  const [quem, setQuem] = useState<'pc' | 'npc'>('pc');
  const [npcId, setNpcId] = useState('');
  const [bonus, setBonus] = useState(0);
  const [privado, setPrivado] = useState(false);
  const [periciaId, setPericiaId] = useState(PERICIAS[0].id);
  const [resultadoRoll, setResultadoRoll] = useState<{ d20: number; modificador: number; total: number; descricao?: string } | null>(null);

  const ficha = fichas.find((f) => f.id === fichaAtivaId) ?? null;
  const npc = npcs.find((n) => n.id === npcId) ?? null;
  const pericia = PERICIAS.find((p) => p.id === periciaId)!;
  const atributo = ATRIBUTOS.find((a) => a.id === pericia.atributo)!;
  const dt = useDtDaCena();

  useEffect(() => {
    setPrivado(quem === 'npc');
  }, [quem]);

  const visibilidade = privado ? 'privada' as const : 'publica' as const;

  const podeRolarSimples = (quem === 'pc' && ficha !== null) || (quem === 'npc' && npc !== null);
  const podeRolarPericia = quem === 'pc' ? ficha !== null : npc !== null;
  const podeRolar = modo === 'simples' ? podeRolarSimples : podeRolarPericia;

  const rolarSimples = () => {
    setResultadoRoll(null);
    if (quem === 'npc' && !npc) return;
    rolar('1d20', (grupos) => {
      const valor = grupos[0]?.rolls[0]?.value ?? 0;
      const mod = quem === 'npc' ? bonus : 0;
      const total = valor + mod;
      setResultadoRoll({ d20: valor, modificador: mod, total });

      const origem = quem === 'npc' && npc ? npc.nome || 'NPC' : ficha?.nome || 'd20 rápido';
      const id = quem === 'npc' && npc ? npc.id : ficha?.id ?? null;
      const formula = quem === 'npc' && bonus !== 0 ? `d20+${bonus}` : 'd20';
      registrarLog('teste', `${origem} · rolagem rápida (sem perícia/DT) → ${total}`, id);
      registrarRoll({
        origem,
        personagemId: id,
        formula,
        total,
        bruto: valor,
        visibilidade,
      });
    }, 'rede', quem === 'npc' ? (npc?.id ?? null) : (ficha?.id ?? null));
  };

  const rolarPericia = () => {
    if (quem === 'pc' && ficha) {
      setResultadoRoll(null);
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
        setResultadoRoll({ d20: r.d20, modificador: r.modificador, total: r.total, descricao: descricaoResultado(r) });
        const formula = `d20${r.modificador >= 0 ? '+' : ''}${r.modificador}`;
        registrarLog(
          'teste',
          `${ficha.nome || 'Personagem'} · ${atributo.nome}+${pericia.nome} → ${d20}${r.modificador >= 0 ? '+' : ''}${r.modificador} = ${r.total} · ${descricaoResultado(r)}`,
          ficha.id,
        );
        registrarRoll({
          origem: ficha.nome || 'Personagem',
          personagemId: ficha.id,
          formula,
          total: r.total,
          bruto: d20,
          visibilidade,
        });
      }, 'rede', ficha.id);
    } else if (quem === 'npc' && npc) {
      setResultadoRoll(null);
      rolar('1d20', (grupos) => {
        const d20 = grupos[0]?.rolls[0]?.value ?? 0;
        const total = d20 + bonus;
        setResultadoRoll({ d20, modificador: bonus, total });
        const formula = bonus !== 0 ? `d20+${bonus}` : 'd20';
        registrarLog(
          'teste',
          `${npc.nome || 'NPC'} · teste rápido → ${d20}${bonus >= 0 ? '+' : ''}${bonus} = ${total}`,
          npc.id,
        );
        registrarRoll({
          origem: npc.nome || 'NPC',
          personagemId: npc.id,
          formula,
          total,
          bruto: d20,
          visibilidade,
        });
      }, undefined, npc.id);
    }
  };

  const pendenteRef = useRef(false);
  const rolarAtual = modo === 'simples' ? rolarSimples : rolarPericia;
  const rolarAtualRef = useRef(rolarAtual);
  rolarAtualRef.current = rolarAtual;

  useEffect(() => {
    if (pedidoRolagem === 0) return;
    if (ready && !rolando && podeRolar) {
      rolarAtualRef.current();
    } else {
      pendenteRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoRolagem]);

  useEffect(() => {
    if (ready && pendenteRef.current) {
      pendenteRef.current = false;
      if (!rolando && podeRolar) rolarAtualRef.current();
    }
  }, [ready, rolando, podeRolar]);

  if (abaAtual === 'dados') return null;

  return (
    <div style={{ position: 'fixed', right: '1.25rem', bottom: '1.25rem', zIndex: 50 }}>
      {aberto && (
        <div
          className="secao"
          style={{ width: 260, marginBottom: '0.6rem', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h3 className="label" style={{ margin: 0 }}>
              d20 rápido
            </h3>
            <button className="icone-botao" onClick={() => onAbertoChange(false)} title="fechar (atalho: X)">
              ×
            </button>
          </div>
          <div className="vazio" style={{ fontSize: 10, marginBottom: '0.4rem', textAlign: 'center' }}>
            atalhos: R=abrir/rolar · X=fechar
          </div>

          <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.5rem' }}>
            <button
              className={quem === 'pc' ? 'acento' : undefined}
              style={{ flex: 1, fontSize: 11, padding: '0.35em' }}
              onClick={() => setQuem('pc')}
            >
              PC
            </button>
            <button
              className={quem === 'npc' ? 'acento' : undefined}
              style={{ flex: 1, fontSize: 11, padding: '0.35em' }}
              onClick={() => { setQuem('npc'); setModo('simples'); }}
            >
              NPC
            </button>
          </div>

          {quem === 'pc' && (
            <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.5rem' }}>
              <button
                className={modo === 'simples' ? 'acento' : undefined}
                style={{ flex: 1, fontSize: 11, padding: '0.35em' }}
                onClick={() => setModo('simples')}
              >
                simples
              </button>
              <button
                className={modo === 'pericia' ? 'acento' : undefined}
                style={{ flex: 1, fontSize: 11, padding: '0.35em' }}
                onClick={() => setModo('pericia')}
              >
                perícia
              </button>
            </div>
          )}

          {quem === 'npc' && (
            <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.5rem' }}>
              <button
                className={modo === 'simples' ? 'acento' : undefined}
                style={{ flex: 1, fontSize: 11, padding: '0.35em' }}
                onClick={() => setModo('simples')}
              >
                simples
              </button>
            </div>
          )}

          {quem === 'npc' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <div>
                <label htmlFor="qr-npc">NPC</label>
                <select id="qr-npc" value={npcId} onChange={(e) => setNpcId(e.target.value)}>
                  <option value="">— selecione —</option>
                  {npcs.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.nome || 'sem nome'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="qr-bonus">Bônus</label>
                <input
                  id="qr-bonus"
                  type="number"
                  value={bonus}
                  onChange={(e) => setBonus(Number(e.target.value) || 0)}
                />
              </div>
            </div>
          )}

          {modo === 'pericia' && quem === 'pc' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <div>
                <label htmlFor="qr-pericia">Perícia</label>
                <select id="qr-pericia" value={periciaId} onChange={(e) => setPericiaId(e.target.value)}>
                  {PERICIAS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} ({ATRIBUTOS.find((a) => a.id === p.atributo)!.nome})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {!modo2D && (
            <div
              id="dice-overlay-rapido"
              style={{ width: '100%', height: '140px', background: 'var(--concrete-0)', border: '1px solid var(--concrete-2)' }}
            />
          )}
          {modo2D && (
            <p className="vazio" style={{ fontSize: 12 }}>
              sem WebGL nesta máquina — rolando por número, sem o dado físico.
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.4rem' }}>
            <span className="vazio">
              {quem === 'pc'
                ? (ficha ? ficha.nome : 'sem personagem ativo')
                : (npc ? npc.nome : 'selecione um NPC')}
            </span>
            {quem === 'npc' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: '11px' }}>
                <input type="checkbox" checked={privado} onChange={(e) => setPrivado(e.target.checked)} />
                privado
              </label>
            )}
          </div>

          <button
            className="acento"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={!ready || rolando || !podeRolar}
            onClick={rolarAtual}
          >
            {modo === 'simples' ? 'rolar d20' : 'rolar teste'}
          </button>

          {resultadoRoll && (
            <div
              className="alerta-banner mono"
              style={{
                marginTop: '0.5rem',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 12 }}>
                {resultadoRoll.modificador === 0
                  ? `1d20 → ${resultadoRoll.total}`
                  : `1d20: ${resultadoRoll.d20}${resultadoRoll.modificador > 0 ? ` + ${resultadoRoll.modificador}` : ` - ${Math.abs(resultadoRoll.modificador)}`} = ${resultadoRoll.total}`}
                {resultadoRoll.descricao ? ` — ${resultadoRoll.descricao}` : ''}
              </span>
            </div>
          )}
        </div>
      )}
      <button
        onClick={() => onAbertoChange(!aberto)}
        title="rolagem rápida (atalho: R)"
        style={{ borderRadius: '50%', width: 48, height: 48, padding: 0 }}
      >
        d20
      </button>
    </div>
  );
}
