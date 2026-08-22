import { useState } from 'react';
import type { ColorsetId } from '../../dice/colorsets';
import type { TipoRolagemForcada } from '../../dice/registroForcados';
import type { RollGroupResult, RollTermo } from '../../dice/useDiceBox';
import { calcularPvMaximo, estaFerido } from '../../rules/derivados';
import { resolverTeste, type ResultadoTeste } from '../../rules/teste';
import { useStore } from '../../state/store';

/** DT fixa (não useDtDaCena) — trauma é contra o próprio passado,
 *  não contra a dificuldade externa da cena. Intencional. */
const DT_GATILHO = 12;

interface RoladorTraumaProps {
  ready: boolean;
  rolar: (
    notacao: RollTermo[],
    onComplete: (r: RollGroupResult[]) => void,
    colorset?: ColorsetId,
    personagemId?: string | null,
    tipo?: TipoRolagemForcada,
  ) => void;
}

export default function RoladorTrauma({ ready, rolar }: RoladorTraumaProps) {
  const fichas = useStore((s) => s.fichas);
  const basePV = useStore((s) => s.config.basePV);
  const registrarLog = useStore((s) => s.registrarLog);
  const ajustarSanidadeAtual = useStore((s) => s.ajustarSanidadeAtual);
  const ajustarDeterminacao = useStore((s) => s.ajustarDeterminacao);

  const [fichaId, setFichaId] = useState('');
  const [traumaId, setTraumaId] = useState('');
  const [rolando, setRolando] = useState(false);
  const [teste, setTeste] = useState<ResultadoTeste | null>(null);
  const [resolvido, setResolvido] = useState(false);

  const ficha = fichas.find((f) => f.id === fichaId) ?? null;
  const traumasAtivos = ficha?.traumas.filter((t) => !t.virouCicatriz) ?? [];
  const trauma = traumasAtivos.find((t) => t.id === traumaId) ?? null;

  const rolarGatilho = () => {
    if (!ficha || !trauma) return;
    setRolando(true);
    setTeste(null);
    setResolvido(false);
    rolar([{ sides: 20, qty: 1 }], (grupos) => {
      const d20 = grupos[0].rolls[0].value;
      const pvMaximo = calcularPvMaximo(basePV, ficha.atributos.vigor);
      const ferido = estaFerido(ficha.pvAtual, pvMaximo);
      const r = resolverTeste({
        d20,
        atributoId: 'vontade',
        valorAtributo: ficha.atributos.vontade,
        grauPericia: 0,
        personagemFerido: ferido,
        dt: DT_GATILHO,
      });
      setTeste(r);
      setRolando(false);
      if (r.sucesso) {
        setResolvido(true);
        registrarLog(
          'trauma',
          `${ficha.nome || 'Personagem'} · gatilho "${trauma.nome}" · Vontade vs DT${DT_GATILHO} → ${d20}${
            r.modificador >= 0 ? '+' : ''
          }${r.modificador} = ${r.total} · segura`,
          ficha.id,
        );
      } else {
        registrarLog(
          'trauma',
          `${ficha.nome || 'Personagem'} · gatilho "${trauma.nome}" · Vontade vs DT${DT_GATILHO} → ${d20}${
            r.modificador >= 0 ? '+' : ''
          }${r.modificador} = ${r.total} · falha — escolha a resposta`,
          ficha.id,
        );
      }
    }, 'ruido', ficha.id);
  };

  const perderSanidade = () => {
    if (!ficha || !trauma) return;
    // trava os dois botões já no clique, antes do dado assentar — sem isso, um duplo clique (ou
    // clicar "interpretar" enquanto o dado ainda anima) aplica as duas consequências, que
    // deveriam ser mutuamente exclusivas (mesmo guard que RoladorSurto.tsx já usa, síncrono).
    setResolvido(true);
    rolar(
      [{ sides: 4, qty: 1 }],
      (grupos) => {
        const perda = grupos[0].value;
        registrarLog('trauma', `${ficha.nome || 'Personagem'} · trauma "${trauma.nome}" · perde 1d4 (${perda}) de Sanidade`, ficha.id);
        ajustarSanidadeAtual(ficha.id, ficha.sanidadeAtual - perda);
      },
      'ruido',
      ficha.id,
    );
  };

  const interpretar = () => {
    if (!ficha || !trauma) return;
    ajustarDeterminacao(ficha.id, ficha.determinacao + 1);
    registrarLog('trauma', `${ficha.nome || 'Personagem'} · trauma "${trauma.nome}" · interpretou a Resposta, +1 Determinação`, ficha.id);
    setResolvido(true);
  };

  return (
    <section className="secao">
      <h3 className="label">Gatilho de Trauma em cena</h3>

      <div className="campos-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div>
          <label htmlFor="rtr-ficha">Personagem</label>
          <select
            id="rtr-ficha"
            value={fichaId}
            onChange={(e) => {
              setFichaId(e.target.value);
              setTraumaId('');
              setTeste(null);
            }}
          >
            <option value="">— selecione —</option>
            {fichas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome || 'sem nome'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="rtr-trauma">Trauma</label>
          <select
            id="rtr-trauma"
            value={traumaId}
            onChange={(e) => {
              setTraumaId(e.target.value);
              setTeste(null);
              setResolvido(false);
            }}
            disabled={!ficha}
          >
            <option value="">— selecione —</option>
            {traumasAtivos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome || 'sem nome'}
              </option>
            ))}
          </select>
        </div>
      </div>
      {ficha && traumasAtivos.length === 0 && <p className="vazio">nenhum trauma ativo (não-cicatriz) nesta ficha.</p>}

      <button className="acento" style={{ marginTop: '0.75rem' }} disabled={!ready || !trauma || rolando} onClick={rolarGatilho}>
        rolar Vontade vs DT{DT_GATILHO}
      </button>

      {teste && (
        <div
          className="alerta-banner mono"
          style={{
            marginTop: '0.75rem',
            borderColor: teste.sucesso ? 'var(--rede)' : 'var(--ruido)',
            color: teste.sucesso ? 'var(--rede)' : 'var(--ruido)',
          }}
        >
          <span>
            d20={teste.d20} vs DT{DT_GATILHO} — {teste.sucesso ? 'segura o gatilho' : 'falha'}
          </span>
        </div>
      )}

      {teste && !teste.sucesso && !resolvido && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
          <button className="perigo" onClick={perderSanidade}>
            perder 1d4 Sanidade
          </button>
          <button className="acento" onClick={interpretar}>
            interpretar a Resposta (+1 Determinação)
          </button>
        </div>
      )}
    </section>
  );
}
