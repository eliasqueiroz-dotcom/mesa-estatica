import { useState } from 'react';
import { calcularPvMaximo } from '../../rules/derivados';
import { CONDICOES_COMBATE } from '../../rules/data/condicoesCombate';
import { useStore } from '../../state/store';

/** Estado de PV de um combatente, resolvido de ficha (PC) ou NPC. `aplicar` já sabe qual ação
 *  do store chamar, então a linha da lista não precisa saber o tipo. */
interface PvCombatente {
  atual: number;
  maximo: number;
  aplicar: (delta: number) => void;
}

/**
 * Rastreador de combate minimizado — mesmo padrão de GradeOverlay/QuickRollOverlay, no canto
 * inferior central (grid fica no esquerdo, rolagem no direito). Espelha os controles da aba
 * NPCs & Iniciativa, lendo/escrevendo o MESMO estado do store — não duplica lógica. Fica só na
 * aba Mapa (dentro de MapaTab, que vira visibility:hidden nas outras abas, escondendo este fixed).
 */
export default function CombatOverlay() {
  const iniciativa = useStore((s) => s.iniciativa);
  const modoCombate = useStore((s) => s.sessaoPublica.modoCombate);
  const indiceAtualTurno = useStore((s) => s.sessaoPublica.indiceAtualTurno);
  const rodada = useStore((s) => s.sessaoPublica.rodada);
  const condicoesCombate = useStore((s) => s.sessaoPublica.condicoesCombate);
  const fichas = useStore((s) => s.fichas);
  const npcs = useStore((s) => s.npcs);
  const basePV = useStore((s) => s.config.basePV);

  const rolarIniciativaTodos = useStore((s) => s.rolarIniciativaTodos);
  const iniciarModoCombate = useStore((s) => s.iniciarModoCombate);
  const avancarTurno = useStore((s) => s.avancarTurno);
  const encerrarModoCombate = useStore((s) => s.encerrarModoCombate);
  const ajustarPvAtual = useStore((s) => s.ajustarPvAtual);
  const atualizarNpc = useStore((s) => s.atualizarNpc);
  const alternarCondicaoCombate = useStore((s) => s.alternarCondicaoCombate);

  const [aberto, setAberto] = useState(false);

  const pvDoCombatente = (participanteId: string, tipo: 'pc' | 'npc'): PvCombatente | null => {
    if (tipo === 'pc') {
      const ficha = fichas.find((f) => f.id === participanteId);
      if (!ficha) return null;
      return {
        atual: ficha.pvAtual,
        maximo: calcularPvMaximo(basePV, ficha.atributos.vigor),
        aplicar: (delta) => ajustarPvAtual(ficha.id, ficha.pvAtual + delta),
      };
    }
    const npc = npcs.find((n) => n.id === participanteId);
    if (!npc) return null;
    return {
      atual: npc.pvAtual,
      maximo: npc.pvMaximo,
      aplicar: (delta) => atualizarNpc(npc.id, { pvAtual: npc.pvAtual + delta }),
    };
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: '1.25rem',
        transform: 'translateX(-50%)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {aberto && (
        <div
          className="secao"
          style={{ width: 320, maxHeight: '70vh', overflowY: 'auto', marginBottom: '0.6rem', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h3 className="label" style={{ margin: 0 }}>
              combate
            </h3>
            <button className="icone-botao" onClick={() => setAberto(false)} title="fechar">
              ×
            </button>
          </div>

          <div
            className="alerta-banner"
            style={{
              marginBottom: '0.6rem',
              borderColor: modoCombate ? 'var(--rede)' : undefined,
              color: modoCombate ? 'var(--rede)' : undefined,
            }}
          >
            <span className="mono" style={{ fontSize: 12 }}>
              {modoCombate
                ? `rodada ${rodada} · vez de ${iniciativa[indiceAtualTurno]?.nome ?? '?'}`
                : 'fora de combate'}
            </span>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {modoCombate ? (
                <>
                  <button className="icone-botao acento" onClick={avancarTurno}>
                    próximo
                  </button>
                  <button className="icone-botao" onClick={encerrarModoCombate}>
                    encerrar
                  </button>
                </>
              ) : (
                <>
                  <button className="icone-botao" onClick={rolarIniciativaTodos} disabled={fichas.length === 0 && npcs.length === 0}>
                    rolar inic.
                  </button>
                  <button className="icone-botao acento" onClick={iniciarModoCombate} disabled={iniciativa.length === 0}>
                    iniciar
                  </button>
                </>
              )}
            </div>
          </div>

          {iniciativa.length === 0 ? (
            <p className="vazio" style={{ fontSize: 12 }}>
              sem ordem de combate — role a iniciativa quando o encontro começar.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {iniciativa.map((e, i) => {
                const naVez = modoCombate && i === indiceAtualTurno;
                const pv = pvDoCombatente(e.participanteId, e.tipo);
                const ativas = condicoesCombate[e.participanteId] ?? [];
                return (
                  <div
                    key={e.id}
                    className="combate-linha"
                    style={naVez ? { borderColor: 'var(--rede)' } : undefined}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                      <span style={{ fontSize: 13, color: naVez ? 'var(--rede)' : undefined }}>
                        <span className="mono">{naVez ? '▶' : i + 1}</span> {e.nome}
                      </span>
                      {pv && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <button className="icone-botao" onClick={() => pv.aplicar(-1)} title="dano">
                            −
                          </button>
                          <span className="mono" style={{ fontSize: 12, minWidth: 44, textAlign: 'center' }}>
                            {pv.atual}/{pv.maximo}
                          </span>
                          <button className="icone-botao" onClick={() => pv.aplicar(1)} title="cura">
                            +
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="combate-condicoes">
                      {CONDICOES_COMBATE.map((c) => {
                        const ligada = ativas.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            className={`combate-chip${ligada ? ' combate-chip--ativa' : ''}`}
                            title={c.efeito}
                            onClick={() => alternarCondicaoCombate(e.participanteId, c.id)}
                          >
                            {c.nome}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      <button
        onClick={() => setAberto(!aberto)}
        title="combate"
        style={
          modoCombate
            ? { borderRadius: '50%', width: 48, height: 48, padding: 0, borderColor: 'var(--rede-dim)', color: 'var(--rede)' }
            : { borderRadius: '50%', width: 48, height: 48, padding: 0 }
        }
      >
        {modoCombate ? `R${rodada}` : 'IN'}
      </button>
    </div>
  );
}
