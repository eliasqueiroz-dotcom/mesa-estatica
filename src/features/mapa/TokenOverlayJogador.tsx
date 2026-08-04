import { useEffect } from 'react';
import Avatar from '../../components/Avatar';
import { calcularDefesa, calcularPvMaximo, calcularSanidadeMaxima } from '../../rules/derivados';
import { personagemEstaEmSurto } from '../../rules/surto';
import { useStore } from '../../state/store';
import type { Ficha } from '../../state/types';
import CombatenteResumo from '../combate/CombatenteResumo';

const EMPTY_CONDICOES: string[] = [];

interface Props {
  minhaFicha: Ficha;
  nome: string;
  cor: string;
  foto: string | null;
  silhueta: string | null;
  /** null = é o próprio PC (mostra detalhes); qualquer string = restrito */
  idFora: string | null;
  onFechar: () => void;
}

export default function TokenOverlayJogador({ minhaFicha, nome, cor, foto, silhueta, idFora, onFechar }: Props) {
  const basePV = useStore((s) => s.config.basePV);
  const ajustarPvAtual = useStore((s) => s.ajustarPvAtual);
  const ajustarSanidadeAtual = useStore((s) => s.ajustarSanidadeAtual);
  const atualizarFicha = useStore((s) => s.atualizarFicha);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
            <Avatar nome={nome} cor={cor} foto={foto} silhueta={silhueta} bordaCor={cor} tamanho={52} ampliavel />
            <h3 style={{ margin: 0 }}>{nome || 'sem nome'}</h3>
          </div>
          <button className="icone-botao" onClick={onFechar} title="fechar (Esc)" style={{ color: 'var(--ruido)' }}>
            ×
          </button>
        </div>

        {idFora === null ? (
          <>
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
            <div style={{ marginTop: '0.75rem' }}>
              <label className="label" style={{ fontSize: 11, display: 'block', marginBottom: '0.25rem' }}>
                observações de combate
              </label>
              <textarea
                rows={3}
                value={minhaFicha.observacaoCombate ?? ''}
                onChange={(e) => atualizarFicha(minhaFicha.id, { observacaoCombate: e.target.value })}
                placeholder="anotações de PV, defesa, condições…"
                style={{ width: '100%', minHeight: '2.5em', fontSize: 12 }}
              />
            </div>
          </>
        ) : (
          <p className="vazio" style={{ textAlign: 'center', margin: '1.5rem 0' }}>
            informação restrita ao mestre
          </p>
        )}
      </div>
    </div>
  );
}
