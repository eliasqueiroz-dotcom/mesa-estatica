import { useEffect } from 'react';
import { calcularPvMaximo, calcularSanidadeMaxima } from '../../rules/derivados';
import { PROTECOES } from '../../rules/data/armas';
import { PERICIAS } from '../../rules/data/pericias';
import { personagemEstaEmSurto } from '../../rules/surto';
import { descricaoSurto } from '../../rules/data/surto';
import { useStore } from '../../state/store';
import type { ArmaFicha, Ficha } from '../../state/types';
import { NOMES_TIPO_REGULADOR } from '../fichas/sections/ReguladoresSection';

interface Props {
  tipo: 'pc' | 'npc';
  id: string;
  onFechar: () => void;
}

interface StepperProps {
  label: string;
  atual: number;
  maximo: number;
  onAjustar: (delta: number) => void;
}

function StepperLinha({ label, atual, maximo, onAjustar }: StepperProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
      <span className="vazio">{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <button className="icone-botao" onClick={() => onAjustar(-1)}>
          −
        </button>
        <span className="mono">
          {atual} / {maximo}
        </span>
        <button className="icone-botao" onClick={() => onAjustar(1)}>
          +
        </button>
      </div>
    </div>
  );
}

const Separador = () => <div style={{ borderTop: '1px solid var(--concrete-2)', margin: '0.6rem 0' }} />;

function truncar(texto: string, max: number): string {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
}

function resumoArmas(armas: ArmaFicha[]): string {
  if (armas.length === 0) return 'nenhuma';
  const nomes = armas.slice(0, 3).map((a) => (a.dano ? `${a.nome || 'sem nome'} (${a.dano})` : a.nome || 'sem nome'));
  const resto = armas.length - 3;
  return resto > 0 ? `${nomes.join(', ')}, +${resto}` : nomes.join(', ');
}

function resumoProtecao(bonusDefesa: number): string {
  if (bonusDefesa === 0) return 'nenhuma';
  const def = PROTECOES.find((p) => p.defesa === bonusDefesa);
  return def ? `${def.nome} (+${bonusDefesa} defesa)` : `+${bonusDefesa} defesa`;
}

function resumoRegulador(ficha: Ficha): string {
  if (ficha.anestesiaAte !== null) return 'anestesia ativa';
  if (ficha.reguladores.length === 0) return 'nenhum';
  const ultima = ficha.reguladores[0];
  return `ativo — ${NOMES_TIPO_REGULADOR[ultima.tipo]} (sessão ${ultima.sessao})`;
}

/** Perícias treinadas (grau 3) e veteranas (grau 6) — pra decidir um teste rápido sem abrir a
 *  ficha inteira. */
function resumoPericias(pericias: Ficha['pericias']): { treinadas: string; veteranas: string } {
  const nomesPorGrau = (grau: 3 | 6) =>
    PERICIAS.filter((p) => pericias[p.id] === grau)
      .map((p) => p.nome)
      .join(', ');
  return { treinadas: nomesPorGrau(3), veteranas: nomesPorGrau(6) };
}

/** Overlay de detalhes/ajuste rápido — abre ao CLICAR num token (não arrastar, ver MapaTab),
 *  fecha por X, clique fora, ou Esc. Escreve direto no Zustand — reflete na aba Personagens/NPCs
 *  e vice-versa (mesa-estatica-multiplayer-completo.md Parte II §1). PC ganha um resumo compacto
 *  (surto/trauma ativos, acessos, neuro-regulador, itens, armas, proteção) pra não precisar abrir
 *  a ficha inteira no meio da cena (correcoes-parte2.md item 12). */
export default function TokenOverlay({ tipo, id, onFechar }: Props) {
  const ficha = useStore((s) => (tipo === 'pc' ? s.fichas.find((f) => f.id === id) : undefined));
  const npc = useStore((s) => (tipo === 'npc' ? s.npcs.find((n) => n.id === id) : undefined));
  const basePV = useStore((s) => s.config.basePV);
  const ajustarPvAtual = useStore((s) => s.ajustarPvAtual);
  const ajustarSanidadeAtual = useStore((s) => s.ajustarSanidadeAtual);
  const ajustarDeterminacao = useStore((s) => s.ajustarDeterminacao);
  const atualizarNpc = useStore((s) => s.atualizarNpc);
  const modoCombate = useStore((s) => s.sessaoPublica.modoCombate);
  const contadorCena = useStore((s) => s.sessaoPublica.contadorCena);
  const rodada = useStore((s) => s.sessaoPublica.rodada);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onFechar]);

  if (tipo === 'pc' && !ficha) return null;
  if (tipo === 'npc' && !npc) return null;

  const traumasAtivos = ficha?.traumas.filter((t) => !t.virouCicatriz) ?? [];
  const emSurto = ficha ? personagemEstaEmSurto(ficha.surtoAtivo, { modoCombate, contadorCena, rodada }) : false;

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
          <h3 style={{ margin: 0 }}>{(tipo === 'pc' ? ficha!.nome : npc!.nome) || 'sem nome'}</h3>
          <button className="icone-botao" onClick={onFechar} title="fechar (Esc)">
            ×
          </button>
        </div>

        {tipo === 'pc' && ficha && (
          <>
            <StepperLinha
              label="PV"
              atual={ficha.pvAtual}
              maximo={calcularPvMaximo(basePV, ficha.atributos.vigor)}
              onAjustar={(d) => ajustarPvAtual(ficha.id, ficha.pvAtual + d)}
            />
            <StepperLinha
              label="Sanidade"
              atual={ficha.sanidadeAtual}
              maximo={calcularSanidadeMaxima(ficha.atributos.vontade)}
              onAjustar={(d) => ajustarSanidadeAtual(ficha.id, ficha.sanidadeAtual + d)}
            />
            <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span className="label" style={{ fontSize: '12px' }}>
                Determinação
              </span>
              {[1, 2].map((n) => (
                <label key={n} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={ficha.determinacao >= n}
                    onChange={() => ajustarDeterminacao(ficha.id, ficha.determinacao >= n ? n - 1 : n)}
                  />
                </label>
              ))}
            </div>

            {(emSurto || traumasAtivos.length > 0) && (
              <>
                <Separador />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {emSurto && (
                    <span
                      className="badge"
                      style={{ borderColor: 'var(--ruido)', color: 'var(--ruido)', alignSelf: 'flex-start' }}
                      title={ficha.surtoEscolha ? descricaoSurto(ficha.surtoEscolha) : undefined}
                    >
                      surto{ficha.surtoEscolha ? `: ${ficha.surtoEscolha}` : ' ativo — aguardando escolha'}
                    </span>
                  )}
                  {traumasAtivos.map((t) => (
                    <span key={t.id} className="badge" style={{ alignSelf: 'flex-start' }}>
                      trauma: {t.nome || 'sem nome'}
                      {t.gatilho ? ` — ${t.gatilho}` : ''}
                    </span>
                  ))}
                </div>
              </>
            )}

            <Separador />
            <div className="vazio mono" style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {(() => {
                const { treinadas, veteranas } = resumoPericias(ficha.pericias);
                if (!treinadas && !veteranas) return <span>perícias: nenhuma treinada</span>;
                return (
                  <>
                    {treinadas && <span>treinado: {treinadas}</span>}
                    {veteranas && <span>veterano: {veteranas}</span>}
                  </>
                );
              })()}
              <span>
                acessos: {ficha.acessos} · neuro-regulador: {resumoRegulador(ficha)}
              </span>
              <span>itens: {ficha.outrosItens ? truncar(ficha.outrosItens, 60) : 'nenhum'}</span>
              <span>armas: {resumoArmas(ficha.armas)}</span>
              <span>proteção: {resumoProtecao(ficha.equipamentoModificadorDefesa)}</span>
            </div>
          </>
        )}

        {tipo === 'npc' && npc && (
          <>
            <div className="campos-grid">
              <div>
                <label htmlFor="ov-npc-pv">PV atual</label>
                <input
                  id="ov-npc-pv"
                  type="number"
                  value={npc.pvAtual}
                  onChange={(e) => atualizarNpc(npc.id, { pvAtual: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label htmlFor="ov-npc-pvmax">PV máximo</label>
                <input
                  id="ov-npc-pvmax"
                  type="number"
                  value={npc.pvMaximo}
                  onChange={(e) => atualizarNpc(npc.id, { pvMaximo: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label htmlFor="ov-npc-defesa">Defesa</label>
                <input
                  id="ov-npc-defesa"
                  type="number"
                  value={npc.defesa}
                  onChange={(e) => atualizarNpc(npc.id, { defesa: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label htmlFor="ov-npc-agi">Agilidade</label>
                <input
                  id="ov-npc-agi"
                  type="number"
                  value={npc.agilidade}
                  onChange={(e) => atualizarNpc(npc.id, { agilidade: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
            <textarea
              placeholder="notas — comportamento, gatilho, o que ele quer"
              value={npc.notas}
              onChange={(e) => atualizarNpc(npc.id, { notas: e.target.value })}
              style={{ marginTop: '0.4rem', minHeight: '3em' }}
            />
          </>
        )}
      </div>
    </div>
  );
}
