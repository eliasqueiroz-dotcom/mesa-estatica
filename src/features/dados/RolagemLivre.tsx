import { useEffect, useState } from 'react';
import type { RollGroupResult, RollTermo } from '../../dice/useDiceBox';
import { useStore } from '../../state/store';

const TODAS_AS_FACES = [4, 6, 8, 10, 12, 20, 100];

interface Termo {
  id: string;
  quantidade: number;
  faces: number;
}

function termoVazio(faces = 20): Termo {
  return { id: crypto.randomUUID(), quantidade: 1, faces };
}

interface RolagemLivreProps {
  ready: boolean;
  rolar: (notacao: RollTermo[], onComplete: (r: RollGroupResult[]) => void) => void;
}

type ModoRolagem = 'nenhum' | 'pc' | 'npc';

export default function RolagemLivre({ ready, rolar }: RolagemLivreProps) {
  const fichas = useStore((s) => s.fichas);
  const npcs = useStore((s) => s.npcs);
  const registrarLog = useStore((s) => s.registrarLog);
  const registrarRoll = useStore((s) => s.registrarRoll);

  const [modo, setModo] = useState<ModoRolagem>('nenhum');
  const [fichaId, setFichaId] = useState('');
  const [npcId, setNpcId] = useState('');
  const [bonus, setBonus] = useState(0);
  const [privado, setPrivado] = useState(false);
  const [termos, setTermos] = useState<Termo[]>([termoVazio()]);
  const [grupos, setGrupos] = useState<RollGroupResult[] | null>(null);
  const [rolando, setRolando] = useState(false);

  const ficha = fichas.find((f) => f.id === fichaId) ?? null;
  const npc = npcs.find((n) => n.id === npcId) ?? null;
  const podeRolar = ready && !rolando;

  useEffect(() => {
    setPrivado(modo === 'npc');
  }, [modo]);

  const visibilidade = privado ? 'privada' as const : 'publica' as const;

  const atualizarTermo = (id: string, patch: Partial<Termo>) => {
    setTermos((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const adicionarTermo = () => setTermos((prev) => [...prev, termoVazio()]);
  const removerTermo = (id: string) => setTermos((prev) => (prev.length > 1 ? prev.filter((t) => t.id !== id) : prev));

  const rolarPreset = (faces: number) => setTermos([termoVazio(faces)]);

  const rolarCombinado = () => {
    if (modo === 'nenhum') return;
    setRolando(true);
    setGrupos(null);
    const notacao: RollTermo[] = termos.map((t) => ({ sides: t.faces, qty: t.quantidade }));
    rolar(notacao, (resultados) => {
      setGrupos(resultados);
      setRolando(false);

      const resumo = resultados
        .map((g) => `${g.qty}d${g.sides} → ${g.value} [${g.rolls.map((r) => r.value).join(', ')}]`)
        .join(' · ');
      const total = resultados.reduce((soma, g) => soma + g.value, 0);
      const texto = `Rolagem livre · ${notacaoTexto} → ${resumo}${resultados.length > 1 ? ` · total ${total}` : ''}`;
      registrarLog('rolagem-livre', texto, null);

      if (modo === 'npc' && npc) {
        const origem = npc.nome || 'NPC';
        const totalComBonus = total + bonus;
        registrarRoll({
          origem,
          personagemId: npc.id,
          formula: `${notacaoTexto}${bonus !== 0 ? `+${bonus}` : ''}`,
          total: totalComBonus,
          bruto: total,
          visibilidade,
        });
      } else if (modo === 'pc' && ficha) {
        const origem = ficha.nome || 'Personagem';
        registrarRoll({
          origem,
          personagemId: ficha.id,
          formula: notacaoTexto,
          total,
          bruto: total,
          visibilidade,
        });
      }
    });
  };

  const totalGeral = grupos?.reduce((soma, g) => soma + g.value, 0) ?? null;
  const notacaoTexto = termos.map((t) => `${t.quantidade}d${t.faces}`).join(' + ');

  return (
    <section className="secao">
      <h3 className="label">Rolagem livre</h3>

      <div className="campos-grid">
        <div>
          <label htmlFor="rl-modo">Quem está rolando</label>
          <select
            id="rl-modo"
            value={modo}
            onChange={(e) => setModo(e.target.value as ModoRolagem)}
          >
            <option value="nenhum">— selecione —</option>
            <option value="pc">PC</option>
            <option value="npc">NPC</option>
          </select>
        </div>
      </div>

      {modo === 'npc' && (
        <div className="campos-grid" style={{ gridTemplateColumns: '1fr', marginTop: '0.5rem' }}>
          <div>
            <label htmlFor="rl-npc">NPC</label>
            <select id="rl-npc" value={npcId} onChange={(e) => setNpcId(e.target.value)}>
              <option value="">— selecione —</option>
              {npcs.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nome || 'sem nome'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rl-bonus">Bônus</label>
            <input
              id="rl-bonus"
              type="number"
              value={bonus}
              onChange={(e) => setBonus(Number(e.target.value) || 0)}
            />
          </div>
        </div>
      )}

      {modo === 'pc' && (
        <div style={{ marginTop: '0.5rem' }}>
          <label htmlFor="rl-ficha">Personagem</label>
          <select id="rl-ficha" value={fichaId} onChange={(e) => setFichaId(e.target.value)}>
            <option value="">— selecione —</option>
            {fichas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome || 'sem nome'}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.75rem', marginBottom: '0.75rem' }}>
        {TODAS_AS_FACES.map((f) => (
          <button key={f} onClick={() => rolarPreset(f)} disabled={!podeRolar || modo === 'nenhum'}>
            1d{f}
          </button>
        ))}
      </div>

      {termos.map((t) => (
        <div key={t.id} className="linha-repetivel" style={{ gridTemplateColumns: '80px 120px 1fr auto' }}>
          <input
            type="number"
            min={1}
            max={20}
            value={t.quantidade}
            onChange={(e) => atualizarTermo(t.id, { quantidade: Math.max(1, Number(e.target.value) || 1) })}
          />
          <select value={t.faces} onChange={(e) => atualizarTermo(t.id, { faces: Number(e.target.value) })}>
            {TODAS_AS_FACES.map((f) => (
              <option key={f} value={f}>
                d{f}
              </option>
            ))}
          </select>
          <span className="vazio" style={{ alignSelf: 'center' }}>
            {t.quantidade}d{t.faces}
          </span>
          <button className="icone-botao perigo" onClick={() => removerTermo(t.id)} disabled={termos.length <= 1}>
            remover
          </button>
        </div>
      ))}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
        <button className="acento" onClick={adicionarTermo}>
          + combinar outro dado
        </button>
        <button disabled={!podeRolar || modo === 'nenhum' || rolando} onClick={rolarCombinado}>
          rolar {notacaoTexto}
        </button>
        {modo === 'npc' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={privado}
              onChange={(e) => setPrivado(e.target.checked)}
            />
            privado
          </label>
        )}
      </div>

      {grupos && (
        <div className="alerta-banner mono" style={{ marginTop: '0.75rem', borderColor: 'var(--rede)', color: 'var(--rede)' }}>
          <span>
            {grupos.map((g) => `${g.qty}d${g.sides} → ${g.value} [${g.rolls.map((r) => r.value).join(', ')}]`).join(' · ')}
            {grupos.length > 1 && ` · total ${totalGeral}`}
          </span>
        </div>
      )}
    </section>
  );
}
