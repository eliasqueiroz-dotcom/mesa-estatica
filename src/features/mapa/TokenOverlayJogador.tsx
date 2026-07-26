import { useEffect } from 'react';
import { calcularDefesa, calcularPvMaximo, calcularSanidadeMaxima } from '../../rules/derivados';
import { personagemEstaEmSurto } from '../../rules/surto';
import { useStore } from '../../state/store';
import type { Ficha } from '../../state/types';
import CombatenteResumo from '../combate/CombatenteResumo';

const EMPTY_CONDICOES: string[] = [];

interface Props {
  minhaFicha: Ficha;
  nome: string;
  /** null = é o próprio PC (mostra detalhes); qualquer string = restrito */
  idFora: string | null;
  onFechar: () => void;
}

export default function TokenOverlayJogador({ minhaFicha, nome, idFora, onFechar }: Props) {
  const basePV = useStore((s) => s.config.basePV);
  const ajustarPvAtual = useStore((s) => s.ajustarPvAtual);
  const ajustarSanidadeAtual = useStore((s) => s.ajustarSanidadeAtual);
  const modoCombate = useStore((s) => s.sessaoPublica.modoCombate);
  const contadorCena = useStore((s) => s.sessaoPublica.contadorCena);
  const rodada = useStore((s) => s.sessaoPublica.rodada);
  const condicoesAtivas = useStore((s) => s.sessaoPublica.condicoesCombate[minhaFicha.id] ?? EMPTY_CONDICOES);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onFechar]);

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

        {idFora === null ? (
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
        ) : (
          <p className="vazio" style={{ textAlign: 'center', margin: '1.5rem 0' }}>
            informação restrita ao mestre
          </p>
        )}
      </div>
    </div>
  );
}
