import { useEffect, useRef, useState } from 'react';
import { formatarLogRolagem, normalizarTermos, useDiceBox } from '../../dice/useDiceBox';
import { resolverRolagemJogador } from '../../multiplayer/rolagemRemota';
import { calcularPvMaximo, estaFerido } from '../../rules/derivados';
import { ATRIBUTOS, PERICIAS } from '../../rules/data/pericias';
import { rolarDanoArmaFicha } from '../../rules/armasCombate';
import { parseDanoArma } from '../../rules/teste';
import { rolarTestePericiaFicha } from '../../rules/testePericia';
import { usePedidoRolagemDanoStore, type PedidoRolagemDano } from '../../state/pedidoRolagemDanoStore';
import { usePedidoRolagemTesteStore, type PedidoRolagemTeste } from '../../state/pedidoRolagemTesteStore';
import { marcarComoProprio, useRolagemAoVivoStore } from '../../state/rolagemAoVivoStore';
import { useStore } from '../../state/store';
import type { Ficha } from '../../state/types';

interface Props {
  ficha: Ficha;
  abaAtual: string;
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  pedidoRolagem: number;
}

/**
 * d20 rápido do jogador — versão reduzida de `QuickRollOverlay.tsx`: sem alternância PC/NPC
 * (só a própria ficha), sem checkbox "privado" (rolagem do jogador é sempre pública — a
 * distinção privada/pública era só pra rolagem de NPC do mestre), sem sucesso/falha no modo
 * perícia (a DT da cena é segredo do mestre — mesmo raciocínio de `RoladorTesteJogador`).
 * Bandeja física própria (`useDiceBox` com `resolverRolagemJogador`), separada da bandeja da
 * aba Dados — mesmo padrão do mestre (duas instâncias independentes).
 */
export default function QuickRollOverlayJogador({ ficha, abaAtual, aberto, onAbertoChange, pedidoRolagem }: Props) {
  const habilitado = abaAtual !== 'dados' && aberto;
  const { ready, rolando, modo2D, rolar, reproduzir } = useDiceBox('dice-overlay-jogador', habilitado, 45, resolverRolagemJogador);
  const basePV = useStore((s) => s.config.basePV);
  const registrarLog = useStore((s) => s.registrarLog);
  const registrarRoll = useStore((s) => s.registrarRoll);

  const [modo, setModo] = useState<'simples' | 'pericia'>('simples');
  const [periciaId, setPericiaId] = useState(PERICIAS[0].id);
  const [bonus, setBonus] = useState(0);
  const [resultadoRoll, setResultadoRoll] = useState<{ d20: number; modificador: number; total: number } | null>(null);
  const [resultadoDano, setResultadoDano] = useState<{ nomeArma: string; texto: string; erro: boolean } | null>(null);
  const [resultadoTeste, setResultadoTeste] = useState<{ rotulo: string; texto: string } | null>(null);
  const pedidoDano = usePedidoRolagemDanoStore((s) => s.pedido);
  const limparPedidoRolagemDano = usePedidoRolagemDanoStore((s) => s.limparPedidoRolagemDano);
  const pedidoTeste = usePedidoRolagemTesteStore((s) => s.pedido);
  const limparPedidoRolagemTeste = usePedidoRolagemTesteStore((s) => s.limparPedidoRolagemTeste);

  const pericia = PERICIAS.find((p) => p.id === periciaId)!;
  const atributo = ATRIBUTOS.find((a) => a.id === pericia.atributo)!;

  // transmite a rolagem pra mesa toda ver o dado caindo (rolagemAoVivoStore/rolagemAoVivoSync) —
  // mesmo wrapper de DadosTabJogador.tsx, aqui só com os dois call sites locais. `bonusRolagem`
  // (6º parâmetro, opcional) é o modificador de perícia/atributo — não passa pela física, só
  // entra no total mostrado pelo aviso ao vivo (formatarHeaderRolagem).
  const rolarEBroadcast = (
    notacao: Parameters<typeof rolar>[0],
    onComplete: Parameters<typeof rolar>[1],
    colorset?: Parameters<typeof rolar>[2],
    personagemId?: Parameters<typeof rolar>[3],
    tipo?: Parameters<typeof rolar>[4],
    bonusRolagem?: number,
  ) => {
    rolar(
      notacao,
      (grupos) => {
        onComplete(grupos);
        const id = crypto.randomUUID();
        marcarComoProprio(id);
        useRolagemAoVivoStore.getState().definirAtual({
          id,
          termos: normalizarTermos(notacao),
          valores: grupos.flatMap((g) => g.rolls.map((r) => r.value)),
          colorsetBase: typeof colorset === 'string' ? colorset : 'rede',
          cor: ficha.corVisual,
          origem: ficha.nome || 'jogador',
          tipo: tipo ?? 'teste',
          bonus: bonusRolagem,
        });
      },
      colorset,
      personagemId,
      tipo,
    );
  };

  const rolarSimples = () => {
    setResultadoRoll(null);
    rolarEBroadcast(
      '1d20',
      (grupos) => {
        const valor = grupos[0]?.rolls[0]?.value ?? 0;
        const mod = bonus;
        const total = valor + mod;
        setResultadoRoll({ d20: valor, modificador: mod, total });

        const nome = ficha.nome || 'd20 rápido';
        const formula = bonus !== 0 ? `d20+${bonus}` : 'd20';
        registrarLog(
          'teste',
          formatarLogRolagem({ quem: nome, tipo: 'Rolagem Rápida', grupos: [{ notacao: '1d20', resultados: [valor] }], bonus, total }),
          ficha.id,
          'publica',
        );
        registrarRoll({
          origem: nome,
          personagemId: ficha.id,
          formula,
          total,
          bruto: valor,
          visibilidade: 'publica',
        });
      },
      'rede',
      ficha.id,
      undefined,
      bonus || undefined,
    );
  };

  const rolarPericia = () => {
    setResultadoRoll(null);
    const pvMaximo = calcularPvMaximo(basePV, ficha.atributos.vigor);
    const ferido = estaFerido(ficha.pvAtual, pvMaximo);
    const penalidadeFerido = ferido && (pericia.atributo === 'vigor' || pericia.atributo === 'agilidade') ? -2 : 0;
    const grauPericia = ficha.pericias[periciaId] ?? 0;
    const modificador = ficha.atributos[pericia.atributo] + grauPericia + penalidadeFerido;
    rolarEBroadcast(
      '1d20',
      (grupos) => {
        const d20 = grupos[0]?.rolls[0]?.value ?? 0;
        setResultadoRoll({ d20, modificador, total: d20 + modificador });

        const nome = ficha.nome || 'Personagem';
        const modStr = modificador >= 0 ? `+${modificador}` : `${modificador}`;
        registrarLog(
          'teste',
          formatarLogRolagem({
            quem: nome,
            tipo: `Teste de Perícia: ${pericia.nome}(${atributo.nome})`,
            grupos: [{ notacao: '1d20', resultados: [d20] }],
            bonus: modificador,
            total: d20 + modificador,
          }),
          ficha.id,
          'publica',
        );
        registrarRoll({
          origem: nome,
          personagemId: ficha.id,
          formula: `d20${modStr}`,
          total: d20 + modificador,
          bruto: d20,
          visibilidade: 'publica',
        });
      },
      'rede',
      ficha.id,
      undefined,
      modificador || undefined,
    );
  };

  // Rolagem de dano de arma pedida de fora (chip em `ArmasCombate.tsx`, aba Combate) — a física
  // roda nesta bandeja (a mesma do "d20 rápido") em vez da caixinha 40×40 que existia embutida
  // em cada card de PC (removida — colidia entre instâncias simultâneas, ver `armasCombate.ts`).
  const executarPedidoDano = (p: PedidoRolagemDano) => {
    const arma = ficha.armas.find((a) => a.id === p.armaId);
    if (!arma) {
      limparPedidoRolagemDano();
      return;
    }
    setResultadoDano(null);
    const finalizar = (valoresDados: number[], termos: Parameters<typeof reproduzir>[0]) => {
      const r = rolarDanoArmaFicha(ficha, arma, termos, valoresDados, p.critico, registrarLog, registrarRoll, p.visibilidade);
      setResultadoDano({ nomeArma: arma.nome || 'arma', texto: r.texto, erro: r.erro });
      limparPedidoRolagemDano();
    };
    const parsed = parseDanoArma(arma.dano);
    if (!parsed) {
      finalizar([], []);
      return;
    }
    const termos = [{ sides: parsed.lados, qty: parsed.qtd }];
    if (p.critico) {
      const valoresMaximos = Array(parsed.qtd).fill(parsed.lados);
      reproduzir(termos, valoresMaximos, { base: 'rede', cor: ficha.corVisual }, () => finalizar(valoresMaximos, termos));
    } else {
      rolar(termos, (grupos) => finalizar(grupos.flatMap((g) => g.rolls.map((r) => r.value)), termos), 'rede', ficha.id, 'dano');
    }
  };

  // Pedido de teste de perícia/ataque de arma vindo de fora (`ArmasCombate.tsx` pro ataque,
  // `PericiasSection.tsx` pro teste solo) — mesma ponte de `executarPedidoDano` acima, mesma
  // bandeja física.
  const executarPedidoTeste = (p: PedidoRolagemTeste) => {
    const pericia = PERICIAS.find((per) => per.id === p.periciaId);
    if (!pericia) {
      limparPedidoRolagemTeste();
      return;
    }
    setResultadoTeste(null);
    rolar('1d20', (grupos) => {
      const d20 = grupos[0]?.rolls[0]?.value ?? 0;
      const r = rolarTestePericiaFicha(ficha, pericia, d20, basePV, registrarLog, registrarRoll, p.visibilidade, p.rotuloArma);
      setResultadoTeste({ rotulo: p.rotuloArma ?? pericia.nome, texto: r.texto });
      limparPedidoRolagemTeste();
    }, 'rede', ficha.id, 'teste');
  };

  const pendenteRef = useRef(false);
  const rolarAtual = modo === 'simples' ? rolarSimples : rolarPericia;
  const rolarAtualRef = useRef(rolarAtual);
  rolarAtualRef.current = rolarAtual;

  useEffect(() => {
    if (pedidoRolagem === 0) return;
    if (ready && !rolando) {
      rolarAtualRef.current();
    } else {
      pendenteRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoRolagem]);

  useEffect(() => {
    if (ready && pendenteRef.current) {
      pendenteRef.current = false;
      if (!rolando) rolarAtualRef.current();
    }
  }, [ready, rolando]);

  // Mesmo padrão acima, pro pedido de dano.
  const pedidoDanoPendenteRef = useRef<PedidoRolagemDano | null>(null);
  const executarPedidoDanoRef = useRef(executarPedidoDano);
  executarPedidoDanoRef.current = executarPedidoDano;

  useEffect(() => {
    if (!pedidoDano) return;
    if (ready && !rolando) {
      executarPedidoDanoRef.current(pedidoDano);
    } else {
      pedidoDanoPendenteRef.current = pedidoDano;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoDano?.id]);

  useEffect(() => {
    if (ready && !rolando && pedidoDanoPendenteRef.current) {
      const p = pedidoDanoPendenteRef.current;
      pedidoDanoPendenteRef.current = null;
      executarPedidoDanoRef.current(p);
    }
  }, [ready, rolando]);

  // Mesmo padrão acima, pro pedido de teste de perícia/ataque.
  const pedidoTestePendenteRef = useRef<PedidoRolagemTeste | null>(null);
  const executarPedidoTesteRef = useRef(executarPedidoTeste);
  executarPedidoTesteRef.current = executarPedidoTeste;

  useEffect(() => {
    if (!pedidoTeste) return;
    if (ready && !rolando) {
      executarPedidoTesteRef.current(pedidoTeste);
    } else {
      pedidoTestePendenteRef.current = pedidoTeste;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoTeste?.id]);

  useEffect(() => {
    if (ready && !rolando && pedidoTestePendenteRef.current) {
      const p = pedidoTestePendenteRef.current;
      pedidoTestePendenteRef.current = null;
      executarPedidoTesteRef.current(p);
    }
  }, [ready, rolando]);

  if (abaAtual === 'dados') return null;

  return (
    <div style={{ position: 'fixed', right: '1.25rem', bottom: '1.25rem', zIndex: 50 }}>
      {aberto && (
        <div className="secao" style={{ width: 260, marginBottom: '0.6rem', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
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

          {modo === 'simples' && (
            <div style={{ marginBottom: '0.5rem' }}>
              <label htmlFor="qrj-bonus">Bônus</label>
              <input
                id="qrj-bonus"
                type="number"
                value={bonus}
                onChange={(e) => setBonus(Number(e.target.value) || 0)}
              />
            </div>
          )}

          {modo === 'pericia' && (
            <div style={{ marginBottom: '0.5rem' }}>
              <label htmlFor="qrj-pericia">Perícia</label>
              <select id="qrj-pericia" value={periciaId} onChange={(e) => setPericiaId(e.target.value)}>
                {PERICIAS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} ({ATRIBUTOS.find((a) => a.id === p.atributo)!.nome})
                  </option>
                ))}
              </select>
            </div>
          )}

          {!modo2D && (
            <div
              id="dice-overlay-jogador"
              style={{
                width: '100%',
                height: '140px',
                background: 'var(--concrete-0)',
                border: '1px solid var(--concrete-2)',
                position: 'relative',
                overflow: 'hidden',
              }}
            />
          )}
          {modo2D && (
            <p className="vazio" style={{ fontSize: 12 }}>
              sem WebGL nesta máquina — rolando por número, sem o dado físico.
            </p>
          )}

          <div style={{ marginTop: '0.4rem' }}>
            <span className="vazio">{ficha.nome || 'sem nome'}</span>
          </div>

          <button className="acento" style={{ width: '100%', marginTop: '0.5rem' }} disabled={!ready || rolando} onClick={rolarAtual}>
            {modo === 'simples' ? 'rolar d20' : 'rolar teste'}
          </button>

          {resultadoRoll && (
            <div className="alerta-banner mono" style={{ marginTop: '0.5rem', justifyContent: 'center' }}>
              <span style={{ fontSize: 12 }}>
                {resultadoRoll.modificador === 0
                  ? `1d20 → ${resultadoRoll.total}`
                  : `1d20: ${resultadoRoll.d20}${resultadoRoll.modificador > 0 ? ` + ${resultadoRoll.modificador}` : ` - ${Math.abs(resultadoRoll.modificador)}`} = ${resultadoRoll.total}`}
              </span>
            </div>
          )}

          {resultadoDano && (
            <div
              className="alerta-banner mono"
              style={{ marginTop: '0.5rem', justifyContent: 'center', borderColor: resultadoDano.erro ? 'var(--ruido)' : undefined }}
            >
              <span style={{ fontSize: 12, color: resultadoDano.erro ? 'var(--ruido)' : undefined }}>
                dano · {resultadoDano.nomeArma}: {resultadoDano.texto}
              </span>
            </div>
          )}

          {resultadoTeste && (
            <div className="alerta-banner mono" style={{ marginTop: '0.5rem', justifyContent: 'center' }}>
              <span style={{ fontSize: 12 }}>
                {resultadoTeste.rotulo}: {resultadoTeste.texto}
              </span>
            </div>
          )}
        </div>
      )}
      <button onClick={() => onAbertoChange(!aberto)} title="rolagem rápida (atalho: R)" style={{ borderRadius: '50%', width: 48, height: 48, padding: 0 }}>
        d20
      </button>
    </div>
  );
}
