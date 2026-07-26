import { useEffect } from 'react';
import type { FichaPublica } from '../../multiplayer/fichaSplit';
import { calcularDefesa, calcularPvMaximo, calcularSanidadeMaxima } from '../../rules/derivados';
import { personagemEstaEmSurto } from '../../rules/surto';
import { useStore } from '../../state/store';
import type { Ficha, Npc } from '../../state/types';
import CombatenteResumo from '../combate/CombatenteResumo';

const EMPTY_CONDICOES: string[] = [];

interface Props {
  tipo: 'pc' | 'npc';
  participanteId: string;
  minhaFicha: Ficha;
  outrasFichas: FichaPublica[];
  npcs: Omit<Npc, 'notasMestre'>[];
  onFechar: () => void;
}

/**
 * Overlay de detalhes ao clicar num token no mapa do jogador (mesa-estatica-multiplayer-completo.md
 * Parte IV §4) — mesma chrome de modal de `TokenOverlay.tsx`/`ImportarPersonagemBotao.tsx`
 * (fixo, caixa `.secao` central, Esc/clique-fora fecha), mas NÃO reaproveita `TokenOverlay.tsx`
 * direto — aquele é a superfície de edição total do mestre (condições, notas de NPC, ações).
 * Três ramos: próprio PC (editável — PV/Sanidade via `ajustarPvAtual`/`ajustarSanidadeAtual`,
 * seguro por construção porque no bundle do jogador `s.fichas` só contém a própria ficha, ver
 * `useMinhaFicha`), PC alheio (read-only, via `FichaPublica`, que já tem `defesa` pública),
 * NPC (read-only, já 100% público).
 */
export default function TokenOverlayJogador({ tipo, participanteId, minhaFicha, outrasFichas, npcs, onFechar }: Props) {
  const basePV = useStore((s) => s.config.basePV);
  const ajustarPvAtual = useStore((s) => s.ajustarPvAtual);
  const ajustarSanidadeAtual = useStore((s) => s.ajustarSanidadeAtual);
  const modoCombate = useStore((s) => s.sessaoPublica.modoCombate);
  const contadorCena = useStore((s) => s.sessaoPublica.contadorCena);
  const rodada = useStore((s) => s.sessaoPublica.rodada);
  const condicoesAtivas = useStore((s) => s.sessaoPublica.condicoesCombate[participanteId] ?? EMPTY_CONDICOES);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onFechar]);

  const souEu = tipo === 'pc' && participanteId === minhaFicha.id;
  const ficha = tipo === 'pc' && !souEu ? outrasFichas.find((f) => f.id === participanteId) : undefined;
  const npc = tipo === 'npc' ? npcs.find((n) => n.id === participanteId) : undefined;

  if (!souEu && !ficha && !npc) return null;

  const nome = souEu ? minhaFicha.nome : ficha ? ficha.nome : npc!.nome;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11, 13, 17, 0.6)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onFechar}
    >
      <div className="secao" style={{ width: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>{nome || 'sem nome'}</h3>
          <button className="icone-botao" onClick={onFechar} title="fechar (Esc)" style={{ color: 'var(--ruido)' }}>
            ×
          </button>
        </div>

        {souEu && (
          <CombatenteResumo
            nome=""
            cor={minhaFicha.corVisual}
            pvAtual={minhaFicha.pvAtual}
            pvMaximo={calcularPvMaximo(basePV, minhaFicha.atributos.vigor)}
            defesa={calcularDefesa(minhaFicha.atributos.agilidade, minhaFicha.equipamentoModificadorDefesa)}
            condicoes={condicoesAtivas}
            surtoAtivo={personagemEstaEmSurto(minhaFicha.surtosAtivos, { modoCombate, contadorCena, rodada })}
            surtoEscolha={minhaFicha.surtosAtivos.find((s) => s.escolha !== null)?.escolha ?? null}
            editavel
            sanidadeAtual={minhaFicha.sanidadeAtual}
            sanidadeMaxima={calcularSanidadeMaxima(minhaFicha.atributos.vontade)}
            onAjustarPv={(d) => ajustarPvAtual(minhaFicha.id, minhaFicha.pvAtual + d)}
            onAjustarSanidade={(d) => ajustarSanidadeAtual(minhaFicha.id, minhaFicha.sanidadeAtual + d)}
          />
        )}

        {ficha && (
          <CombatenteResumo
            nome=""
            cor={ficha.corVisual}
            pvAtual={ficha.pvAtual}
            pvMaximo={ficha.pvMaximo}
            defesa={ficha.defesa}
            condicoes={condicoesAtivas}
            surtoAtivo={personagemEstaEmSurto(ficha.surtosAtivos, { modoCombate, contadorCena, rodada })}
            surtoEscolha={ficha.surtosAtivos.find((s) => s.escolha !== null)?.escolha ?? null}
          />
        )}

        {npc && (
          <CombatenteResumo
            nome=""
            cor={npc.corVisual}
            pvAtual={npc.pvAtual}
            pvMaximo={npc.pvMaximo}
            defesa={npc.defesa}
            condicoes={condicoesAtivas}
          />
        )}
      </div>
    </div>
  );
}
